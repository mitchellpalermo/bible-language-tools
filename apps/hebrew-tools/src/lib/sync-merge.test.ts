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

  it('prefers the card with more repetitions', () => {
    const a = { מֶלֶךְ: card({ repetition: 1 }) };
    const b = { מֶלֶךְ: card({ repetition: 5 }) };

    expect(mergeSRSStores(a, b).מֶלֶךְ.repetition).toBe(5);
    expect(mergeSRSStores(b, a).מֶלֶךְ.repetition).toBe(5);
  });

  it('breaks repetition ties by the later due date', () => {
    const a = { מֶלֶךְ: card({ repetition: 3, dueDate: '2026-08-10' }) };
    const b = { מֶלֶךְ: card({ repetition: 3, dueDate: '2026-09-01' }) };

    expect(mergeSRSStores(a, b).מֶלֶךְ.dueDate).toBe('2026-09-01');
    expect(mergeSRSStores(b, a).מֶלֶךְ.dueDate).toBe('2026-09-01');
  });

  it('never drops a review — a studied card beats an untouched one', () => {
    const studied = { מֶלֶךְ: card({ repetition: 4 }) };
    const fresh = { מֶלֶךְ: card({ repetition: 0, dueDate: '2026-12-31' }) };

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

  it('a stale high streak does not beat a live lower one', () => {
    // The regression: picking the larger streak dragged its month-old anchor
    // along, and loadStats() then zeroed the whole thing because the anchor was
    // neither today nor yesterday — a stale device silently ate a live streak.
    const stale = stats({ streak: 12, lastStreakDate: '2026-08-01', totalReviewed: 500 });
    const live = stats({ streak: 3, lastStreakDate: '2026-09-05', totalReviewed: 40 });

    const merged = mergeStudyStats(live, stale);
    expect(merged.streak).toBe(3);
    expect(merged.lastStreakDate).toBe('2026-09-05');
    expect(mergeStudyStats(stale, live)).toEqual(merged);
  });

  it('a stale but busier device does not supply the daily fields', () => {
    // Same failure one field over: most lifetime reviews is not "studied today".
    const stale = stats({
      totalReviewed: 500,
      cardsStudiedToday: 30,
      lastStudyDate: '2026-08-01',
    });
    const live = stats({ totalReviewed: 40, cardsStudiedToday: 6, lastStudyDate: '2026-09-05' });

    const merged = mergeStudyStats(stale, live);
    expect(merged.cardsStudiedToday).toBe(6);
    expect(merged.lastStudyDate).toBe('2026-09-05');
    // The lifetime counter still takes the max — that part was never wrong.
    expect(merged.totalReviewed).toBe(500);
  });

  it('breaks a date tie on the larger counter', () => {
    const a = stats({ streak: 4, lastStreakDate: '2026-09-05' });
    const b = stats({ streak: 9, lastStreakDate: '2026-09-05' });

    expect(mergeStudyStats(a, b).streak).toBe(9);
    expect(mergeStudyStats(b, a).streak).toBe(9);
  });

  it('a device that has never hit the threshold cannot win the streak', () => {
    const never = stats({ streak: 0, lastStreakDate: '', totalReviewed: 900 });
    const some = stats({ streak: 2, lastStreakDate: '2026-09-04', totalReviewed: 20 });

    expect(mergeStudyStats(never, some).streak).toBe(2);
    expect(mergeStudyStats(some, never).streak).toBe(2);
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

  it('is symmetric when date and magnitude disagree', () => {
    // The case the old rule got wrong; symmetry must survive the new tiebreak.
    const a = stats({
      streak: 12,
      lastStreakDate: '2026-08-01',
      lastStudyDate: '2026-08-01',
      totalReviewed: 500,
      totalCorrect: 400,
    });
    const b = stats({
      streak: 3,
      lastStreakDate: '2026-09-05',
      lastStudyDate: '2026-09-05',
      totalReviewed: 40,
      totalCorrect: 30,
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
