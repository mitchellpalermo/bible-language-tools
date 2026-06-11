// Server-side persistence for /api/progress.
//
// All functions take a Drizzle SQLite database so they run against both the
// production D1 binding and better-sqlite3 in tests. Writes are issued as a
// single db.batch() where the driver supports it (D1 batches are atomic —
// D1 has no interactive transactions); the better-sqlite3 test driver has no
// batch, so statements run sequentially there.

import type * as schema from '@tools/db/schema';
import {
  customDecks as customDecksTable,
  type Language,
  srsCards as srsCardsTable,
  studyStats as studyStatsTable,
  syncState as syncStateTable,
} from '@tools/db/schema';
import { and, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { CustomDeck } from '../data/customDecks';
import type { SRSCard, StudyStats } from '../data/srs';
import type { ProgressPayload } from './sync-types';

export type ProgressDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;

const LANGUAGE: Language = 'greek';

// D1 allows at most 100 bound parameters per statement, so bulk inserts are
// chunked: srs_cards has 8 columns (12 rows/statement), custom_decks has 6.
const SRS_CHUNK = 12;
const DECK_CHUNK = 16;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function runAtomic(db: ProgressDb, statements: unknown[]): Promise<void> {
  const batch = (db as unknown as { batch?: (stmts: unknown[]) => Promise<unknown> }).batch;
  if (typeof batch === 'function') {
    await batch.call(db, statements);
    return;
  }
  for (const stmt of statements) await stmt;
}

const emptyStats = (): StudyStats => ({
  streak: 0,
  lastStreakDate: '',
  cardsStudiedToday: 0,
  lastStudyDate: '',
  totalReviewed: 0,
  totalCorrect: 0,
});

/**
 * Read the user's full progress. Returns null when the user has never synced
 * (no sync_state row), which the client renders as "no server-side progress".
 */
export async function getProgress(db: ProgressDb, userId: string): Promise<ProgressPayload | null> {
  const [state] = await db
    .select()
    .from(syncStateTable)
    .where(and(eq(syncStateTable.userId, userId), eq(syncStateTable.language, LANGUAGE)));
  if (!state) return null;

  const cardRows = await db
    .select()
    .from(srsCardsTable)
    .where(and(eq(srsCardsTable.userId, userId), eq(srsCardsTable.language, LANGUAGE)));
  const [statsRow] = await db
    .select()
    .from(studyStatsTable)
    .where(and(eq(studyStatsTable.userId, userId), eq(studyStatsTable.language, LANGUAGE)));
  const deckRows = await db
    .select()
    .from(customDecksTable)
    .where(and(eq(customDecksTable.userId, userId), eq(customDecksTable.language, LANGUAGE)));

  const srsStore: Record<string, SRSCard> = {};
  for (const row of cardRows) {
    srsStore[row.wordKey] = {
      key: row.wordKey,
      interval: row.interval,
      repetition: row.repetition,
      easeFactor: row.easeFactor,
      dueDate: row.dueDate,
      lastReviewed: row.lastReviewed,
    };
  }

  const studyStats: StudyStats = statsRow
    ? {
        streak: statsRow.streak,
        lastStreakDate: statsRow.lastStreakDate,
        cardsStudiedToday: statsRow.cardsStudiedToday,
        lastStudyDate: statsRow.lastStudyDate,
        totalReviewed: statsRow.totalReviewed,
        totalCorrect: statsRow.totalCorrect,
      }
    : emptyStats();

  const customDecks: CustomDeck[] = deckRows.map((row) => ({
    id: row.id,
    name: row.name,
    wordKeys: JSON.parse(row.wordKeys) as string[],
    createdAt: row.createdAt,
  }));

  return { srsStore, studyStats, customDecks, syncedAt: state.syncedAt };
}

/**
 * Replace the user's full progress with the given payload.
 * Returns the server-assigned syncedAt timestamp.
 */
export async function putProgress(
  db: ProgressDb,
  userId: string,
  payload: Pick<ProgressPayload, 'srsStore' | 'studyStats' | 'customDecks'>,
): Promise<string> {
  const syncedAt = new Date().toISOString();
  const userLang = { userId, language: LANGUAGE };

  const cardRows = Object.entries(payload.srsStore).map(([wordKey, card]) => ({
    ...userLang,
    wordKey,
    interval: card.interval,
    repetition: card.repetition,
    easeFactor: card.easeFactor,
    dueDate: card.dueDate,
    lastReviewed: card.lastReviewed,
  }));

  const deckRows = payload.customDecks.map((deck) => ({
    ...userLang,
    id: deck.id,
    name: deck.name,
    wordKeys: JSON.stringify(deck.wordKeys),
    createdAt: deck.createdAt,
  }));

  const statements: unknown[] = [
    db
      .delete(srsCardsTable)
      .where(and(eq(srsCardsTable.userId, userId), eq(srsCardsTable.language, LANGUAGE))),
    ...chunk(cardRows, SRS_CHUNK).map((rows) => db.insert(srsCardsTable).values(rows)),
    db
      .delete(studyStatsTable)
      .where(and(eq(studyStatsTable.userId, userId), eq(studyStatsTable.language, LANGUAGE))),
    db.insert(studyStatsTable).values({ ...userLang, ...payload.studyStats }),
    db
      .delete(customDecksTable)
      .where(and(eq(customDecksTable.userId, userId), eq(customDecksTable.language, LANGUAGE))),
    ...chunk(deckRows, DECK_CHUNK).map((rows) => db.insert(customDecksTable).values(rows)),
    db
      .delete(syncStateTable)
      .where(and(eq(syncStateTable.userId, userId), eq(syncStateTable.language, LANGUAGE))),
    db.insert(syncStateTable).values({ ...userLang, syncedAt }),
  ];

  await runAtomic(db, statements);
  return syncedAt;
}

/** Delete all of the user's progress (the "Start fresh" import option). */
export async function deleteProgress(db: ProgressDb, userId: string): Promise<void> {
  await runAtomic(db, [
    db
      .delete(srsCardsTable)
      .where(and(eq(srsCardsTable.userId, userId), eq(srsCardsTable.language, LANGUAGE))),
    db
      .delete(studyStatsTable)
      .where(and(eq(studyStatsTable.userId, userId), eq(studyStatsTable.language, LANGUAGE))),
    db
      .delete(customDecksTable)
      .where(and(eq(customDecksTable.userId, userId), eq(customDecksTable.language, LANGUAGE))),
    db
      .delete(syncStateTable)
      .where(and(eq(syncStateTable.userId, userId), eq(syncStateTable.language, LANGUAGE))),
  ]);
}
