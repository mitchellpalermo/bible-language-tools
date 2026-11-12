import { describe, expect, it } from 'vitest';
import type { SRSCard, StudyStats } from '../data/srs';
import { mergeProgress, mergeSRSStores, mergeStudyStats } from './sync-merge';

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
    streak: 0,
    lastStreakDate: '',
    cardsStudiedToday: 0,
    lastStudyDate: '',
    totalReviewed: 0,
    totalCorrect: 0,
    ...overrides,
  };
}

describe('mergeSRSStores', () => {
  it('keeps cards that exist on only one side', () => {
    const a = { מֶלֶךְ: card({ key: 'מֶלֶךְ' }) };
    const b = { דָּבָר: card({ key: 'דָּבָר' }) };

    expect(Object.keys(mergeSRSStores(a, b)).sort()).toEqual(['דָּבָר', 'מֶלֶךְ'].sort());
  });

  it('prefers more repetitions when both were reviewed on the same date', () => {
    const a = { מֶלֶךְ: card({ repetition: 1 }) };
    const b = { מֶלֶךְ: card({ repetition: 5 }) };

    expect(mergeSRSStores(a, b).מֶלֶךְ.repetition).toBe(5);
    expect(mergeSRSStores(b, a).מֶלֶךְ.repetition).toBe(5);
  });

  it('breaks a same-date repetition tie by the later due date', () => {
    const a = { מֶלֶךְ: card({ repetition: 3, dueDate: '2026-08-10' }) };
    const b = { מֶלֶךְ: card({ repetition: 3, dueDate: '2026-09-01' }) };

    expect(mergeSRSStores(a, b).מֶלֶךְ.dueDate).toBe('2026-09-01');
    expect(mergeSRSStores(b, a).מֶלֶךְ.dueDate).toBe('2026-09-01');
  });

  it('never drops a review — a studied card beats an untouched one', () => {
    const studied = { מֶלֶךְ: card({ repetition: 4 }) };
    // A never-reviewed card carries lastReviewed: '', which sorts below every
    // real date, so a fresh card cannot displace real progress.
    const fresh = {
      מֶלֶךְ: card({ repetition: 0, dueDate: '2026-12-31', lastReviewed: '' }),
    };

    expect(mergeSRSStores(studied, fresh).מֶלֶךְ.repetition).toBe(4);
  });

  it('handles empty stores on either side', () => {
    const a = { מֶלֶךְ: card() };
    expect(mergeSRSStores(a, {})).toEqual(a);
    expect(mergeSRSStores({}, a)).toEqual(a);
    expect(mergeSRSStores({}, {})).toEqual({});
  });

  it('does not mutate its inputs', () => {
    const a = { מֶלֶךְ: card({ repetition: 1 }) };
    const b = { מֶלֶךְ: card({ repetition: 5 }) };
    mergeSRSStores(a, b);

    expect(a.מֶלֶךְ.repetition).toBe(1);
    expect(b.מֶלֶךְ.repetition).toBe(5);
  });
});

describe('mergeStudyStats', () => {
  it('takes the max of the cumulative counters', () => {
    const merged = mergeStudyStats(
      stats({ totalReviewed: 100, totalCorrect: 80 }),
      stats({ totalReviewed: 40, totalCorrect: 95 }),
    );

    expect(merged.totalReviewed).toBe(100);
    expect(merged.totalCorrect).toBe(95);
  });

  it('takes daily fields from the more active device', () => {
    const busy = stats({ totalReviewed: 100, cardsStudiedToday: 12, lastStudyDate: '2026-08-08' });
    const idle = stats({ totalReviewed: 5, cardsStudiedToday: 1, lastStudyDate: '2026-07-01' });

    expect(mergeStudyStats(busy, idle).cardsStudiedToday).toBe(12);
    expect(mergeStudyStats(idle, busy).lastStudyDate).toBe('2026-08-08');
  });

  it('keeps the streak and its anchor date consistent', () => {
    // The higher streak must not be paired with the other device's date, or the
    // next recordReview() would compute the break incorrectly.
    const long = stats({ streak: 9, lastStreakDate: '2026-08-07' });
    const short = stats({ streak: 2, lastStreakDate: '2026-06-01' });

    const merged = mergeStudyStats(short, long);
    expect(merged.streak).toBe(9);
    expect(merged.lastStreakDate).toBe('2026-08-07');
  });

  it('is symmetric', () => {
    const a = stats({
      streak: 4,
      lastStreakDate: '2026-08-01',
      totalReviewed: 50,
      totalCorrect: 40,
    });
    const b = stats({
      streak: 7,
      lastStreakDate: '2026-08-07',
      totalReviewed: 20,
      totalCorrect: 18,
    });

    expect(mergeStudyStats(a, b)).toEqual(mergeStudyStats(b, a));
  });
});

describe('mergeProgress', () => {
  it('is symmetric across the whole snapshot', () => {
    const a = {
      srsStore: { מֶלֶךְ: card({ repetition: 1 }), אֵשׁ: card({ key: 'אֵשׁ', repetition: 6 }) },
      studyStats: stats({ streak: 3, totalReviewed: 40 }),
    };
    const b = {
      srsStore: { מֶלֶךְ: card({ repetition: 4 }), צֹאן: card({ key: 'צֹאן', repetition: 2 }) },
      studyStats: stats({ streak: 8, totalReviewed: 12 }),
    };

    expect(mergeProgress(a, b)).toEqual(mergeProgress(b, a));
  });

  it('unions the cards and keeps the furthest-along version of each', () => {
    const local = { srsStore: { מֶלֶךְ: card({ repetition: 1 }) }, studyStats: stats() };
    const server = {
      srsStore: { מֶלֶךְ: card({ repetition: 3 }), דָּבָר: card({ key: 'דָּבָר' }) },
      studyStats: stats(),
    };

    const merged = mergeProgress(local, server);
    expect(Object.keys(merged.srsStore)).toHaveLength(2);
    expect(merged.srsStore.מֶלֶךְ.repetition).toBe(3);
  });
});

describe('mergeProgress and the Today study streak', () => {
  const base = { srsStore: {}, studyStats: stats() };

  it('keeps the later session date and its own streak', () => {
    const a = { ...base, studyStreak: { streak: 30, lastSessionDate: '2026-09-01' } };
    const b = { ...base, studyStreak: { streak: 2, lastSessionDate: '2026-11-02' } };
    expect(mergeProgress(a, b).studyStreak).toEqual({ streak: 2, lastSessionDate: '2026-11-02' });
    expect(mergeProgress(b, a).studyStreak).toEqual(mergeProgress(a, b).studyStreak);
  });

  it('treats a snapshot without one as never studied', () => {
    const b = { ...base, studyStreak: { streak: 4, lastSessionDate: '2026-11-02' } };
    expect(mergeProgress(base, b).studyStreak).toEqual(b.studyStreak);
    expect(mergeProgress(base, base).studyStreak).toEqual({ streak: 0, lastSessionDate: '' });
  });
});

describe('mergeProgress and the suffix ladder', () => {
  const base = { srsStore: {}, studyStats: stats() };

  it('keeps the larger count per rung, symmetrically', () => {
    const a = { ...base, ladderProgress: { r1: 2, r2: 1 } };
    const b = { ...base, ladderProgress: { r1: 1, r3: 1 } };
    expect(mergeProgress(a, b).ladderProgress).toEqual({ r1: 2, r2: 1, r3: 1 });
    expect(mergeProgress(b, a)).toEqual(mergeProgress(a, b));
  });

  it('treats a snapshot without one as a fresh ladder', () => {
    const b = { ...base, ladderProgress: { r1: 2 } };
    expect(mergeProgress(base, b).ladderProgress).toEqual({ r1: 2 });
    expect(mergeProgress(base, base).ladderProgress).toEqual({});
  });
});

describe('mergeProgress and custom decks', () => {
  const base = { srsStore: {}, studyStats: stats() };
  const deck = (over = {}) => ({
    id: 'd1',
    name: 'Genesis 1',
    wordKeys: ['a'],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...over,
  });

  it('unions decks, and treats a snapshot with none as having none', () => {
    const merged = mergeProgress(
      { ...base, customDecks: [deck()] },
      { ...base, customDecks: [deck({ id: 'd2' })] },
    );
    expect(merged.customDecks?.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(mergeProgress(base, { ...base, customDecks: [deck()] }).customDecks).toHaveLength(1);
    expect(mergeProgress(base, base).customDecks).toEqual([]);
  });

  it('is symmetric, and a deletion survives', () => {
    const tomb = deck({
      wordKeys: [],
      updatedAt: '2026-11-03T00:00:00.000Z',
      deletedAt: '2026-11-03T00:00:00.000Z',
    });
    const ab = mergeProgress({ ...base, customDecks: [deck()] }, { ...base, customDecks: [tomb] });
    const ba = mergeProgress({ ...base, customDecks: [tomb] }, { ...base, customDecks: [deck()] });
    expect(ab.customDecks).toEqual(ba.customDecks);
    expect(ab.customDecks?.[0].deletedAt).toBeDefined();
  });
});

describe('mergeProgress and focus passages', () => {
  const base = { srsStore: {}, studyStats: stats() };
  const passage = (over = {}) => ({
    id: 'p1',
    book: 'GEN',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 5,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...over,
  });

  it('unions passages, and treats a snapshot with none as having none', () => {
    const merged = mergeProgress(
      { ...base, focusPassages: [passage()] },
      { ...base, focusPassages: [passage({ id: 'p2' })] },
    );
    expect(merged.focusPassages?.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(mergeProgress(base, { ...base, focusPassages: [passage()] }).focusPassages).toHaveLength(
      1,
    );
    expect(mergeProgress(base, base).focusPassages).toEqual([]);
  });

  it('is symmetric, and a deletion survives', () => {
    const tomb = passage({
      updatedAt: '2026-11-03T00:00:00.000Z',
      deletedAt: '2026-11-03T00:00:00.000Z',
    });
    const ab = mergeProgress(
      { ...base, focusPassages: [passage()] },
      { ...base, focusPassages: [tomb] },
    );
    const ba = mergeProgress(
      { ...base, focusPassages: [tomb] },
      { ...base, focusPassages: [passage()] },
    );
    expect(ab.focusPassages).toEqual(ba.focusPassages);
    expect(ab.focusPassages?.[0].deletedAt).toBeDefined();
  });
});
