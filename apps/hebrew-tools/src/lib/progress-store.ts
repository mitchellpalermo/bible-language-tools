// Server-side persistence for /api/progress.
//
// All functions take a Drizzle SQLite database so they run against both the
// production D1 binding and better-sqlite3 in tests. Writes are issued as a
// single db.batch() where the driver supports it (D1 batches are atomic — D1
// has no interactive transactions); the better-sqlite3 test driver has no
// batch, so statements run sequentially there.
//
// EVERY statement is scoped by LANGUAGE. The database is shared with
// greek-tools, so an unscoped delete or select reaches into the other app's
// rows for the same user. src/lib/db.test.ts pins that invariant.

import type * as schema from '@tools/db/schema';
import {
  srsCards as srsCardsTable,
  studyStats as studyStatsTable,
  syncState as syncStateTable,
} from '@tools/db/schema';
import { and, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { SRSCard, StudyStats } from '../data/srs';
import { LANGUAGE } from './db';
import { mergeProgress } from './sync-merge';
import type { ProgressPayload } from './sync-types';

export type ProgressDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;

// D1 allows at most 100 bound parameters per statement, so bulk inserts are
// chunked by column count: srs_cards has 8 columns → 12 rows per statement.
// Recompute this if the table gains or loses a column.
const SRS_CHUNK = 12;

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
 * Read the user's full Hebrew progress. Returns null when the user has never
 * synced (no sync_state row), which the client renders as "no server-side
 * progress" and uses to route new vs. returning users after sign-in.
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

  return { srsStore, studyStats, syncedAt: state.syncedAt };
}

/**
 * Merge the given payload into the user's stored Hebrew progress.
 * Returns the server-assigned syncedAt timestamp.
 *
 * MERGES, does not replace. This is the guard that makes a stale client
 * harmless: the session-end push (see registerSessionEndPush) is a one-shot
 * keepalive request that cannot pull first, so a device carrying week-old
 * localStorage will happily PUT it. Merging server-side means such a push can
 * only ever add or hold — never regress another device's work.
 *
 * A client-side fix could not close this: it would only protect clients that
 * behave. The server is the one place the rule holds unconditionally.
 *
 * Deliberate consequence: PUT can never remove a card. Intentional destruction
 * goes through deleteProgress() instead — that is what "Reset SRS" and the
 * "Start fresh" import option call.
 *
 * sync_state is written last: its presence is what marks the account as having
 * synced, so it must not appear before the data it describes.
 */
export async function putProgress(
  db: ProgressDb,
  userId: string,
  payload: Pick<ProgressPayload, 'srsStore' | 'studyStats'>,
): Promise<string> {
  const syncedAt = new Date().toISOString();
  const userLang = { userId, language: LANGUAGE };

  const existing = await getProgress(db, userId);
  // mergeProgress is symmetric, so argument order carries no meaning here.
  const merged = existing
    ? mergeProgress({ srsStore: existing.srsStore, studyStats: existing.studyStats }, payload)
    : payload;

  const cardRows = Object.entries(merged.srsStore).map(([wordKey, card]) => ({
    ...userLang,
    wordKey,
    interval: card.interval,
    repetition: card.repetition,
    easeFactor: card.easeFactor,
    dueDate: card.dueDate,
    lastReviewed: card.lastReviewed,
  }));

  const statements: unknown[] = [
    db
      .delete(srsCardsTable)
      .where(and(eq(srsCardsTable.userId, userId), eq(srsCardsTable.language, LANGUAGE))),
    ...chunk(cardRows, SRS_CHUNK).map((rows) => db.insert(srsCardsTable).values(rows)),
    db
      .delete(studyStatsTable)
      .where(and(eq(studyStatsTable.userId, userId), eq(studyStatsTable.language, LANGUAGE))),
    db.insert(studyStatsTable).values({ ...userLang, ...merged.studyStats }),
    db
      .delete(syncStateTable)
      .where(and(eq(syncStateTable.userId, userId), eq(syncStateTable.language, LANGUAGE))),
    db.insert(syncStateTable).values({ ...userLang, syncedAt }),
  ];

  await runAtomic(db, statements);
  return syncedAt;
}

/** Delete the user's Hebrew progress (the "Start fresh" import option). */
export async function deleteProgress(db: ProgressDb, userId: string): Promise<void> {
  await runAtomic(db, [
    db
      .delete(srsCardsTable)
      .where(and(eq(srsCardsTable.userId, userId), eq(srsCardsTable.language, LANGUAGE))),
    db
      .delete(studyStatsTable)
      .where(and(eq(studyStatsTable.userId, userId), eq(studyStatsTable.language, LANGUAGE))),
    db
      .delete(syncStateTable)
      .where(and(eq(syncStateTable.userId, userId), eq(syncStateTable.language, LANGUAGE))),
  ]);
}
