// @vitest-environment node
//
// Runs against real SQLite with the real migrations, via @tools/db/test-utils.
// The database is shared with greek-tools, so several of these tests exist
// specifically to prove hebrew writes never touch greek rows.

import { createTestDb } from '@tools/db/test-utils';
import { srsCards, studyStats as studyStatsTable, syncState, users } from '@tools/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SRSCard, StudyStats } from '../data/srs';
import { deleteProgress, getProgress, type ProgressDb, putProgress } from './progress-store';

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

  it('does not roll a card back to fewer repetitions', async () => {
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card({ repetition: 8 }) }, studyStats: stats() });
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card({ repetition: 1 }) }, studyStats: stats() });

    expect((await getProgress(db, USER))?.srsStore.מֶלֶךְ.repetition).toBe(8);
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
    await putProgress(db, USER, { srsStore: { מֶלֶךְ: card({ repetition: 2 }) }, studyStats: stats() });
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
