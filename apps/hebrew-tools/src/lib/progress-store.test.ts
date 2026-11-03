// @vitest-environment node
//
// Runs against real SQLite with the real migrations, via @tools/db/test-utils.
// The database is shared with greek-tools, so several of these tests exist
// specifically to prove hebrew writes never touch greek rows.

import {
  attempts as attemptsTable,
  ladderProgress as ladderProgressTable,
  srsCards,
  studyStats as studyStatsTable,
  syncState,
  users,
} from '@tools/db/schema';
import { createTestDb, createTestDbAt } from '@tools/db/test-utils';
import { type Attempt, MAX_ATTEMPTS } from '@tools/shared/attempt-log';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SRSCard, StudyStats } from '../data/srs';
import {
  ATTEMPT_INSERT_CHUNK,
  appendAttempts,
  deleteProgress,
  getAttempts,
  getProgress,
  type ProgressDb,
  putProgress,
} from './progress-store';

const USER = 'user-1';
const OTHER_USER = 'user-2';

let db: ProgressDb;

function card(overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    key: 'מֶלֶךְ',
    interval: 6,
    repetition: 2,
    easeFactor: 2.5,
    dueDate: '2026-08-14',
    lastReviewed: '2026-08-08',
    ...overrides,
  };
}

function stats(overrides: Partial<StudyStats> = {}): StudyStats {
  return {
    streak: 3,
    lastStreakDate: '2026-08-08',
    cardsStudiedToday: 7,
    lastStudyDate: '2026-08-08',
    totalReviewed: 42,
    totalCorrect: 35,
    ...overrides,
  };
}

beforeEach(() => {
  db = createTestDb() as unknown as ProgressDb;
  for (const id of [USER, OTHER_USER]) {
    (db as never as ReturnType<typeof createTestDb>)
      .insert(users)
      .values({ id, email: `${id}@example.com`, createdAt: new Date() })
      .run();
  }
});

describe('getProgress', () => {
  it('returns null before the user has ever synced', async () => {
    expect(await getProgress(db, USER)).toBeNull();
  });

  it('returns the payload after a write', async () => {
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card() }, studyStats: stats() });

    const payload = await getProgress(db, USER);
    expect(payload?.srsStore.מֶלֶךְ.repetition).toBe(2);
    expect(payload?.studyStats.totalReviewed).toBe(42);
    expect(payload?.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('falls back to empty stats when only cards were written', async () => {
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card() }, studyStats: stats() });
    // Simulate a stats row lost independently of sync_state.
    await db.delete(studyStatsTable).where(eq(studyStatsTable.userId, USER));

    const payload = await getProgress(db, USER);
    expect(payload?.studyStats).toEqual({
      streak: 0,
      lastStreakDate: '',
      cardsStudiedToday: 0,
      lastStudyDate: '',
      totalReviewed: 0,
      totalCorrect: 0,
    });
  });

  it('does not leak another user’s progress', async () => {
    await putProgress(db, OTHER_USER, { srsStore: { מֶלֶךְ: card() }, studyStats: stats() });

    expect(await getProgress(db, USER)).toBeNull();
  });
});

describe('putProgress', () => {
  it('merges with what is already stored rather than replacing it', async () => {
    await putProgress(db, USER, {
      srsStore: { מֶלֶךְ: card(), דָּבָר: card({ key: 'דָּבָר' }) },
      studyStats: stats(),
    });
    await putProgress(db, USER, { srsStore: { אֵשׁ: card({ key: 'אֵשׁ' }) }, studyStats: stats() });

    const payload = await getProgress(db, USER);
    expect(Object.keys(payload?.srsStore ?? {}).sort()).toEqual(['אֵשׁ', 'דָּבָר', 'מֶלֶךְ'].sort());
  });

  it('round-trips a store larger than one insert chunk', async () => {
    // srs_cards is chunked at 12 rows per statement for D1's 100-parameter cap.
    const srsStore: Record<string, SRSCard> = {};
    for (let i = 0; i < 40; i++) {
      srsStore[`word-${i}`] = card({ key: `word-${i}`, repetition: i });
    }

    await putProgress(db, USER, { srsStore, studyStats: stats() });

    const payload = await getProgress(db, USER);
    expect(Object.keys(payload?.srsStore ?? {})).toHaveLength(40);
    expect(payload?.srsStore['word-39'].repetition).toBe(39);
  });

  it('handles an empty store', async () => {
    await putProgress(db, USER, { srsStore: {}, studyStats: stats() });

    const payload = await getProgress(db, USER);
    expect(payload?.srsStore).toEqual({});
    expect(payload?.studyStats.totalReviewed).toBe(42);
  });

  it('returns a fresh syncedAt on every write', async () => {
    const first = await putProgress(db, USER, { srsStore: {}, studyStats: stats() });
    const second = await putProgress(db, USER, { srsStore: {}, studyStats: stats() });

    expect(new Date(second).getTime()).toBeGreaterThanOrEqual(new Date(first).getTime());
  });

  it('preserves easeFactor as a real, not an integer', async () => {
    await putProgress(db, USER, {
      srsStore: { מֶלֶךְ: card({ easeFactor: 2.36 }) },
      studyStats: stats(),
    });

    expect((await getProgress(db, USER))?.srsStore.מֶלֶךְ.easeFactor).toBeCloseTo(2.36);
  });
});

describe('a stale client cannot regress stored progress', () => {
  // The session-end push is a one-shot keepalive PUT that cannot pull first, so
  // a device carrying week-old localStorage will send exactly that. These are
  // the tests that say such a push is harmless.

  it('does not drop cards the stale client has never seen', async () => {
    await putProgress(db, USER, {
      srsStore: { מֶלֶךְ: card(), דָּבָר: card({ key: 'דָּבָר' }), אֵשׁ: card({ key: 'אֵשׁ' }) },
      studyStats: stats({ totalReviewed: 200 }),
    });

    // Stale device knows about one card and nothing else.
    await putProgress(db, USER, {
      srsStore: { מֶלֶךְ: card({ repetition: 1 }) },
      studyStats: stats({ totalReviewed: 5, streak: 0, lastStreakDate: '' }),
    });

    const payload = await getProgress(db, USER);
    expect(Object.keys(payload?.srsStore ?? {})).toHaveLength(3);
  });

  it('does not roll a card back when its review is no newer', async () => {
    await putProgress(db, USER, {
      srsStore: { מֶלֶךְ: card({ repetition: 8 }) },
      studyStats: stats(),
    });
    // Same lastReviewed, so this is a stale copy of the same review rather than
    // a newer one — the repetition tiebreak holds it off.
    await putProgress(db, USER, {
      srsStore: { מֶלֶךְ: card({ repetition: 1 }) },
      studyStats: stats(),
    });

    expect((await getProgress(db, USER))?.srsStore.מֶלֶךְ.repetition).toBe(8);
  });

  it('accepts a newer failed review, which is not a regression', async () => {
    // The server half of the lapse bug: putProgress merges with the same rule
    // the client does, so before the fix there was NO path by which a failed
    // review could reach the database. A word you kept failing kept coming back
    // mature. This is the test that says a lapse now actually lands in D1.
    await putProgress(db, USER, {
      srsStore: {
        מֶלֶךְ: card({
          repetition: 8,
          interval: 95,
          dueDate: '2026-11-11',
          lastReviewed: '2026-08-08',
        }),
      },
      studyStats: stats(),
    });
    await putProgress(db, USER, {
      srsStore: {
        מֶלֶךְ: card({
          repetition: 0,
          interval: 1,
          easeFactor: 1.96,
          dueDate: '2026-09-06',
          lastReviewed: '2026-09-05',
        }),
      },
      studyStats: stats(),
    });

    const stored = (await getProgress(db, USER))?.srsStore.מֶלֶךְ;
    expect(stored?.repetition).toBe(0);
    expect(stored?.interval).toBe(1);
    expect(stored?.easeFactor).toBeCloseTo(1.96);
    expect(stored?.dueDate).toBe('2026-09-06');
  });

  it('does not roll cumulative stats backwards', async () => {
    await putProgress(db, USER, {
      srsStore: {},
      studyStats: stats({ totalReviewed: 500, totalCorrect: 400, streak: 12 }),
    });
    await putProgress(db, USER, {
      srsStore: {},
      studyStats: stats({ totalReviewed: 3, totalCorrect: 2, streak: 1 }),
    });

    const merged = (await getProgress(db, USER))?.studyStats;
    expect(merged?.totalReviewed).toBe(500);
    expect(merged?.totalCorrect).toBe(400);
    expect(merged?.streak).toBe(12);
  });

  it('still accepts genuinely new progress from that client', async () => {
    await putProgress(db, USER, {
      srsStore: { מֶלֶךְ: card({ repetition: 2 }) },
      studyStats: stats(),
    });
    await putProgress(db, USER, {
      srsStore: { מֶלֶךְ: card({ repetition: 6 }), צֹאן: card({ key: 'צֹאן' }) },
      studyStats: stats(),
    });

    const payload = await getProgress(db, USER);
    expect(payload?.srsStore.מֶלֶךְ.repetition).toBe(6);
    expect(payload?.srsStore.צֹאן).toBeDefined();
  });

  it('leaves deleteProgress as the only way to remove anything', async () => {
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card() }, studyStats: stats() });

    // An empty PUT cannot clear the account...
    await putProgress(db, USER, { srsStore: {}, studyStats: stats() });
    expect(Object.keys((await getProgress(db, USER))?.srsStore ?? {})).toHaveLength(1);

    // ...but DELETE can.
    await deleteProgress(db, USER);
    expect(await getProgress(db, USER)).toBeNull();
  });
});

describe('greek-tools isolation', () => {
  // The shared database is the single most damaging thing to get wrong here.
  function seedGreekRow() {
    return (db as never as ReturnType<typeof createTestDb>)
      .insert(srsCards)
      .values({
        userId: USER,
        language: 'greek',
        wordKey: 'λόγος',
        interval: 10,
        repetition: 7,
        easeFactor: 2.8,
        dueDate: '2026-09-01',
        lastReviewed: '2026-08-01',
      })
      .run();
  }

  it('writes only hebrew rows', async () => {
    seedGreekRow();
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card() }, studyStats: stats() });

    const all = await db.select().from(srsCards);
    const greek = all.filter((r) => r.language === 'greek');
    expect(greek).toHaveLength(1);
    expect(greek[0].wordKey).toBe('λόγος');
    expect(greek[0].repetition).toBe(7);
  });

  it('reads back only hebrew rows', async () => {
    seedGreekRow();
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card() }, studyStats: stats() });

    const payload = await getProgress(db, USER);
    expect(Object.keys(payload?.srsStore ?? {})).toEqual(['מֶלֶךְ']);
  });

  it('leaves greek untouched when hebrew progress is deleted', async () => {
    seedGreekRow();
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card() }, studyStats: stats() });

    await deleteProgress(db, USER);

    const all = await db.select().from(srsCards);
    expect(all).toHaveLength(1);
    expect(all[0].language).toBe('greek');
  });
});

describe('deleteProgress', () => {
  it('clears the attempt log and the ladder too, or the next pull would bring them back', async () => {
    await putProgress(db, USER, {
      srsStore: {},
      studyStats: stats(),
      ladderProgress: { r1: 2 },
    });
    await appendAttempts(db, USER, [attempt('a', 1)]);

    await deleteProgress(db, USER);

    expect(await getAttempts(db, USER)).toEqual([]);
    expect(await db.select().from(ladderProgressTable)).toEqual([]);
  });

  it('clears cards, stats, and sync state', async () => {
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card() }, studyStats: stats() });

    await deleteProgress(db, USER);

    expect(await getProgress(db, USER)).toBeNull();
    expect(await db.select().from(srsCards).where(eq(srsCards.userId, USER))).toHaveLength(0);
    expect(
      await db.select().from(studyStatsTable).where(eq(studyStatsTable.userId, USER)),
    ).toHaveLength(0);
    expect(await db.select().from(syncState).where(eq(syncState.userId, USER))).toHaveLength(0);
  });

  it('is safe to call when nothing has been synced', async () => {
    await expect(deleteProgress(db, USER)).resolves.toBeUndefined();
  });

  it('does not touch another user', async () => {
    await putProgress(db, OTHER_USER, { srsStore: { מֶלֶךְ: card() }, studyStats: stats() });

    await deleteProgress(db, USER);

    expect(await getProgress(db, OTHER_USER)).not.toBeNull();
  });
});

describe('the Today study streak', () => {
  it('reads back empty when it was never sent', async () => {
    await putProgress(db, USER, { srsStore: {}, studyStats: stats() });
    expect((await getProgress(db, USER))?.studyStreak).toEqual({ streak: 0, lastSessionDate: '' });
  });

  it('round-trips through the stats row', async () => {
    const studyStreak = { streak: 5, lastSessionDate: '2026-11-02' };
    await putProgress(db, USER, { srsStore: {}, studyStats: stats(), studyStreak });
    expect((await getProgress(db, USER))?.studyStreak).toEqual(studyStreak);
  });

  it('is not rolled back by a stale client', async () => {
    const recent = { streak: 5, lastSessionDate: '2026-11-02' };
    await putProgress(db, USER, { srsStore: {}, studyStats: stats(), studyStreak: recent });
    // A device that last studied in September, and one from before the streak existed.
    await putProgress(db, USER, {
      srsStore: {},
      studyStats: stats(),
      studyStreak: { streak: 40, lastSessionDate: '2026-09-01' },
    });
    await putProgress(db, USER, { srsStore: {}, studyStats: stats() });
    expect((await getProgress(db, USER))?.studyStreak).toEqual(recent);
  });
});

describe('an account synced before migration 0003', () => {
  // Rows written by the code before the study streak existed, with plain SQL
  // against the old schema, then migrated: the path every current user takes.
  function migratedAccount() {
    const { sqlite, db: oldDb, migrateRest } = createTestDbAt('0002');
    sqlite
      .prepare("INSERT INTO users (id, email, created_at) VALUES ('u', 'u@example.com', 0)")
      .run();
    const card = sqlite.prepare(
      'INSERT INTO srs_cards (user_id, language, word_key, interval, repetition, ease_factor, due_date, last_reviewed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    card.run('u', 'hebrew', 'מֶלֶךְ', 6, 2, 2.36, '2026-11-08', '2026-11-02');
    card.run('u', 'hebrew', 'paradigm:qal-qatal-strong:3ms', 1, 0, 1.3, '2026-11-03', '2026-11-02');
    card.run('u', 'greek', 'λόγος', 15, 4, 2.5, '2026-11-20', '2026-11-01');
    const stats = sqlite.prepare(
      'INSERT INTO study_stats (user_id, language, streak, last_streak_date, cards_studied_today, last_study_date, total_reviewed, total_correct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    stats.run('u', 'hebrew', 4, '2026-11-02', 10, '2026-11-02', 380, 301);
    stats.run('u', 'greek', 12, '2026-11-01', 31, '2026-11-01', 4210, 3650);
    const synced = sqlite.prepare(
      'INSERT INTO sync_state (user_id, language, synced_at) VALUES (?, ?, ?)',
    );
    synced.run('u', 'hebrew', '2026-11-02T09:00:00.000Z');
    synced.run('u', 'greek', '2026-11-01T20:00:00.000Z');
    const greekBefore = sqlite.prepare("SELECT * FROM study_stats WHERE language = 'greek'").get();
    migrateRest();
    return { db: oldDb as unknown as ProgressDb, sqlite, greekBefore };
  }

  const oldStats = {
    streak: 4,
    lastStreakDate: '2026-11-02',
    cardsStudiedToday: 10,
    lastStudyDate: '2026-11-02',
    totalReviewed: 380,
    totalCorrect: 301,
  };

  it('reads back every card and stat, with an empty study streak', async () => {
    const { db } = migratedAccount();
    const progress = await getProgress(db, 'u');
    expect(Object.keys(progress?.srsStore ?? {}).sort()).toEqual(
      ['paradigm:qal-qatal-strong:3ms', 'מֶלֶךְ'].sort(),
    );
    expect(progress?.srsStore['מֶלֶךְ']).toMatchObject({ interval: 6, easeFactor: 2.36 });
    expect(progress?.studyStats).toEqual(oldStats);
    expect(progress?.studyStreak).toEqual({ streak: 0, lastSessionDate: '' });
  });

  it('loses nothing to a push from a page loaded before the update', async () => {
    const { db } = migratedAccount();
    // An old cached page: no study streak, an emptier store, older stats.
    await putProgress(db, 'u', {
      srsStore: {},
      studyStats: { ...oldStats, totalReviewed: 100, totalCorrect: 80 },
    });
    const progress = await getProgress(db, 'u');
    expect(Object.keys(progress?.srsStore ?? {})).toHaveLength(2);
    expect(progress?.studyStats).toEqual(oldStats);
  });

  it('adds the study streak on the first new push and keeps everything else', async () => {
    const { db } = migratedAccount();
    const studyStreak = { streak: 1, lastSessionDate: '2026-11-02' };
    await putProgress(db, 'u', { srsStore: {}, studyStats: oldStats, studyStreak });
    const progress = await getProgress(db, 'u');
    expect(progress?.studyStreak).toEqual(studyStreak);
    expect(Object.keys(progress?.srsStore ?? {})).toHaveLength(2);
    expect(progress?.studyStats).toEqual(oldStats);
  });

  it('never touches the same person’s greek.tools rows', async () => {
    const { db, sqlite, greekBefore } = migratedAccount();
    await putProgress(db, 'u', {
      srsStore: {},
      studyStats: oldStats,
      studyStreak: { streak: 1, lastSessionDate: '2026-11-02' },
    });
    expect(sqlite.prepare("SELECT * FROM study_stats WHERE language = 'greek'").get()).toEqual({
      ...(greekBefore as object),
      study_streak: 0,
      last_session_date: '',
    });
    expect(
      sqlite.prepare("SELECT word_key, interval FROM srs_cards WHERE language = 'greek'").all(),
    ).toEqual([{ word_key: 'λόγος', interval: 15 }]);
  });
});

function attempt(id: string, at: number, overrides: Partial<Attempt> = {}): Attempt {
  return { id, concept: 'paradigm/qal-qatal-strong:3ms', correct: true, at, ...overrides };
}

describe('ladder progress', () => {
  it('reads back empty when it was never sent', async () => {
    await putProgress(db, USER, { srsStore: {}, studyStats: stats() });
    expect((await getProgress(db, USER))?.ladderProgress).toEqual({});
  });

  it('round-trips, one row per rung', async () => {
    const ladderProgress = { 'suffix-bare-type1': 2, 'suffix-prep-le': 1 };
    await putProgress(db, USER, { srsStore: {}, studyStats: stats(), ladderProgress });
    expect((await getProgress(db, USER))?.ladderProgress).toEqual(ladderProgress);
    expect(await db.select().from(ladderProgressTable)).toHaveLength(2);
  });

  it('round-trips more rungs than one insert chunk', async () => {
    const ladderProgress = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`r${i}`, i]));
    await putProgress(db, USER, { srsStore: {}, studyStats: stats(), ladderProgress });
    expect((await getProgress(db, USER))?.ladderProgress).toEqual(ladderProgress);
  });

  it('is not rolled back by a stale client, and never closes a rung', async () => {
    await putProgress(db, USER, {
      srsStore: {},
      studyStats: stats(),
      ladderProgress: { r1: 3, r2: 2 },
    });
    // A device that saw less, and one from before the ladder synced.
    await putProgress(db, USER, {
      srsStore: {},
      studyStats: stats(),
      ladderProgress: { r1: 1, r3: 1 },
    });
    await putProgress(db, USER, { srsStore: {}, studyStats: stats() });
    expect((await getProgress(db, USER))?.ladderProgress).toEqual({ r1: 3, r2: 2, r3: 1 });
  });

  it('keeps each user’s and each app’s rungs apart', async () => {
    (db as never as ReturnType<typeof createTestDb>)
      .insert(ladderProgressTable)
      .values({ userId: USER, language: 'greek', rungId: 'r1', cleanWrites: 9 })
      .run();
    await putProgress(db, OTHER_USER, {
      srsStore: {},
      studyStats: stats(),
      ladderProgress: { r1: 5 },
    });
    await putProgress(db, USER, { srsStore: {}, studyStats: stats(), ladderProgress: { r1: 1 } });
    await deleteProgress(db, USER);

    expect(await getProgress(db, OTHER_USER)).toMatchObject({ ladderProgress: { r1: 5 } });
    expect(
      await db.select().from(ladderProgressTable).where(eq(ladderProgressTable.language, 'greek')),
    ).toEqual([{ userId: USER, language: 'greek', rungId: 'r1', cleanWrites: 9 }]);
  });
});

describe('the attempt log', () => {
  it('is empty for an account that has none', async () => {
    expect(await getAttempts(db, USER)).toEqual([]);
  });

  it('round-trips every field, and leaves absent ones absent', async () => {
    const full = attempt('a', 1, { correct: false, ms: 1840, confidence: 2 });
    const bare = attempt('b', 2);
    await appendAttempts(db, USER, [full, bare]);
    expect(await getAttempts(db, USER)).toEqual([full, bare]);
  });

  it('reads back oldest first, by time and then id', async () => {
    await appendAttempts(db, USER, [attempt('c', 5), attempt('a', 9), attempt('b', 5)]);
    expect((await getAttempts(db, USER)).map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });

  it('ignores an id it already has, so a push may send one twice', async () => {
    await appendAttempts(db, USER, [attempt('a', 1)]);
    await appendAttempts(db, USER, [attempt('a', 1, { correct: false }), attempt('b', 2)]);
    expect(await getAttempts(db, USER)).toEqual([attempt('a', 1), attempt('b', 2)]);
  });

  it('writes more than one insert chunk in a request', async () => {
    const many = Array.from({ length: ATTEMPT_INSERT_CHUNK * 2 + 1 }, (_, i) =>
      attempt(`a${i}`, i),
    );
    await appendAttempts(db, USER, many);
    expect(await getAttempts(db, USER)).toHaveLength(many.length);
  });

  it('keeps only the newest MAX_ATTEMPTS, the window every device keeps', async () => {
    const many = Array.from({ length: MAX_ATTEMPTS }, (_, i) => attempt(`a${i}`, 100 + i));
    await appendAttempts(db, USER, many);
    await appendAttempts(db, USER, [attempt('older', 1), attempt('newer', 1e9)]);

    const kept = await getAttempts(db, USER);
    expect(kept).toHaveLength(MAX_ATTEMPTS);
    expect(kept[0].id).toBe('a1');
    expect(kept.at(-1)?.id).toBe('newer');
    expect(kept.some((a) => a.id === 'older')).toBe(false);
  });

  it('does nothing for an empty request', async () => {
    await expect(appendAttempts(db, USER, [])).resolves.toBeUndefined();
  });

  it('never prunes, reads or writes another user’s or greek.tools’ attempts', async () => {
    (db as never as ReturnType<typeof createTestDb>)
      .insert(attemptsTable)
      .values({ userId: USER, language: 'greek', id: 'g', concept: 'g', correct: true, at: 0 })
      .run();
    await appendAttempts(db, OTHER_USER, [attempt('theirs', 0)]);
    const many = Array.from({ length: MAX_ATTEMPTS + 1 }, (_, i) => attempt(`a${i}`, 100 + i));
    await appendAttempts(db, USER, many);

    expect(await getAttempts(db, OTHER_USER)).toEqual([attempt('theirs', 0)]);
    expect((await getAttempts(db, USER)).some((a) => a.id === 'g')).toBe(false);
    const greek = await db.select().from(attemptsTable).where(eq(attemptsTable.language, 'greek'));
    expect(greek).toHaveLength(1);

    await deleteProgress(db, USER);
    expect(await db.select().from(attemptsTable)).toHaveLength(2);
  });

  it('is not part of the progress payload', async () => {
    await appendAttempts(db, USER, [attempt('a', 1)]);
    await putProgress(db, USER, { srsStore: {}, studyStats: stats() });
    expect(await getProgress(db, USER)).not.toHaveProperty('attempts');
    expect(await getAttempts(db, USER)).toHaveLength(1);
  });
});

describe('an account synced before migration 0004', () => {
  function migratedAccount() {
    const { sqlite, db: oldDb, migrateRest } = createTestDbAt('0003');
    sqlite
      .prepare("INSERT INTO users (id, email, created_at) VALUES ('u', 'u@example.com', 0)")
      .run();
    sqlite
      .prepare(
        "INSERT INTO srs_cards (user_id, language, word_key, interval, repetition, ease_factor, due_date, last_reviewed) VALUES ('u', 'hebrew', 'מֶלֶךְ', 6, 2, 2.36, '2026-11-08', '2026-11-02')",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO study_stats (user_id, language, streak, last_streak_date, cards_studied_today, last_study_date, total_reviewed, total_correct, study_streak, last_session_date) VALUES ('u', 'hebrew', 4, '2026-11-02', 10, '2026-11-02', 380, 301, 3, '2026-11-02')",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO sync_state (user_id, language, synced_at) VALUES ('u', 'hebrew', '2026-11-02T09:00:00.000Z')",
      )
      .run();
    migrateRest();
    return oldDb as unknown as ProgressDb;
  }

  it('reads back with an empty ladder and an empty attempt log', async () => {
    const migrated = migratedAccount();
    const progress = await getProgress(migrated, 'u');
    expect(progress?.ladderProgress).toEqual({});
    expect(progress?.studyStreak).toEqual({ streak: 3, lastSessionDate: '2026-11-02' });
    expect(Object.keys(progress?.srsStore ?? {})).toEqual(['מֶלֶךְ']);
    expect(await getAttempts(migrated, 'u')).toEqual([]);
  });

  it('takes the first ladder and attempts and keeps everything else', async () => {
    const migrated = migratedAccount();
    await putProgress(migrated, 'u', {
      srsStore: {},
      studyStats: stats({ totalReviewed: 1 }),
      ladderProgress: { r1: 2 },
    });
    await appendAttempts(migrated, 'u', [attempt('a', 1)]);
    const progress = await getProgress(migrated, 'u');
    expect(progress?.ladderProgress).toEqual({ r1: 2 });
    expect(progress?.studyStats.totalReviewed).toBe(380);
    expect(progress?.studyStreak).toEqual({ streak: 3, lastSessionDate: '2026-11-02' });
    expect(Object.keys(progress?.srsStore ?? {})).toEqual(['מֶלֶךְ']);
    expect(await getAttempts(migrated, 'u')).toEqual([attempt('a', 1)]);
  });
});
