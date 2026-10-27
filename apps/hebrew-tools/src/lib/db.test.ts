// Contract test for the shared database package, from hebrew-tools' side.
//
// Two things are being proven here, and both are worth a test rather than a
// one-off manual check:
//
// 1. @tools/db resolves from this app — including the better-sqlite3 test
//    driver and the real migration files, which live in another workspace
//    package and are read off disk at runtime.
// 2. Scoping every statement by LANGUAGE actually isolates this app's rows from
//    greek-tools'. Both apps write to one database, so a query that forgets the
//    language filter would silently corrupt the other app's data. That is the
//    single most damaging mistake available in this area, and it is cheap to
//    guard against here, before any of the sync code exists to make it.

import { srsCards, studyStats, syncState, users } from '@tools/db/schema';
import { createTestDb } from '@tools/db/test-utils';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { LANGUAGE } from './db';

type TestDb = ReturnType<typeof createTestDb>;

const USER_ID = 'user-1';

function seedUser(db: TestDb) {
  db.insert(users).values({ id: USER_ID, email: 'mitch@example.com', createdAt: new Date() }).run();
}

function card(language: 'greek' | 'hebrew', wordKey: string, repetition = 1) {
  return {
    userId: USER_ID,
    language,
    wordKey,
    interval: 6,
    repetition,
    easeFactor: 2.5,
    dueDate: '2026-08-14',
    lastReviewed: '2026-08-07',
  };
}

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
  seedUser(db);
});

describe('LANGUAGE', () => {
  it('is hebrew', () => {
    expect(LANGUAGE).toBe('hebrew');
  });
});

describe('@tools/db resolves from hebrew-tools', () => {
  it('applies the real migrations and exposes the progress tables', () => {
    // Reaching these tables at all means the migration files were found and run.
    expect(db.select().from(srsCards).all()).toEqual([]);
    expect(db.select().from(studyStats).all()).toEqual([]);
    expect(db.select().from(syncState).all()).toEqual([]);
  });

  it('round-trips an SRS card', () => {
    db.insert(srsCards).values(card(LANGUAGE, 'מֶלֶךְ')).run();

    const [row] = db.select().from(srsCards).where(eq(srsCards.language, LANGUAGE)).all();
    expect(row.wordKey).toBe('מֶלֶךְ');
    expect(row.easeFactor).toBeCloseTo(2.5);
    expect(row.dueDate).toBe('2026-08-14');
  });

  it('round-trips study stats and sync state', () => {
    db.insert(studyStats)
      .values({ userId: USER_ID, language: LANGUAGE, streak: 3, totalReviewed: 42 })
      .run();
    db.insert(syncState)
      .values({ userId: USER_ID, language: LANGUAGE, syncedAt: '2026-08-07T19:00:00.000Z' })
      .run();

    const [stats] = db.select().from(studyStats).where(eq(studyStats.language, LANGUAGE)).all();
    expect(stats.streak).toBe(3);
    expect(stats.totalReviewed).toBe(42);
    // Columns hebrew-tools does not set must fall back to their defaults.
    expect(stats.cardsStudiedToday).toBe(0);
    expect(stats.lastStudyDate).toBe('');

    const [state] = db.select().from(syncState).where(eq(syncState.language, LANGUAGE)).all();
    expect(state.syncedAt).toBe('2026-08-07T19:00:00.000Z');
  });
});

describe('language scoping isolates the two apps', () => {
  beforeEach(() => {
    db.insert(srsCards)
      .values(card('greek', 'λόγος', 5))
      .run();
    db.insert(srsCards)
      .values(card(LANGUAGE, 'דָּבָר', 2))
      .run();
  });

  it('reads only this language for a user who studies both', () => {
    const rows = db
      .select()
      .from(srsCards)
      .where(and(eq(srsCards.userId, USER_ID), eq(srsCards.language, LANGUAGE)))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].wordKey).toBe('דָּבָר');
  });

  it('leaves greek rows untouched when clearing this language', () => {
    db.delete(srsCards)
      .where(and(eq(srsCards.userId, USER_ID), eq(srsCards.language, LANGUAGE)))
      .run();

    const remaining = db.select().from(srsCards).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].language).toBe('greek');
    expect(remaining[0].wordKey).toBe('λόγος');
  });

  it('lets the same word key exist independently in both languages', () => {
    // The primary key is (user_id, language, word_key), so an identical key in
    // the other language must not collide.
    db.insert(srsCards)
      .values(card('greek', 'דָּבָר', 9))
      .run();

    const rows = db.select().from(srsCards).where(eq(srsCards.wordKey, 'דָּבָר')).all();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.language).sort()).toEqual(['greek', 'hebrew']);
  });
});
