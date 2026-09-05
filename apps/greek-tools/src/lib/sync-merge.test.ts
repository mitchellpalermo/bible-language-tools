import { describe, expect, it } from 'vitest';
import type { CustomDeck } from '../data/customDecks';
import type { FocusPassage, ParseHistory } from '../data/focusPassages';
import type { SRSCard, StudyStats } from '../data/srs';
import {
  mergeCustomDecks,
  mergeFocusPassages,
  mergeParseHistory,
  mergeProgress,
  mergeSRSStores,
  mergeStudyStats,
} from './sync-merge';

function makeCard(key: string, overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    key,
    interval: 6,
    repetition: 2,
    easeFactor: 2.5,
    dueDate: '2026-06-15',
    lastReviewed: '2026-06-09',
    ...overrides,
  };
}

function makeStats(overrides: Partial<StudyStats> = {}): StudyStats {
  return {
    streak: 3,
    lastStreakDate: '2026-06-08',
    cardsStudiedToday: 5,
    lastStudyDate: '2026-06-09',
    totalReviewed: 100,
    totalCorrect: 80,
    ...overrides,
  };
}

function makeDeck(id: string, overrides: Partial<CustomDeck> = {}): CustomDeck {
  return {
    id,
    name: `Deck ${id}`,
    wordKeys: ['λόγος'],
    createdAt: '2026-06-01T12:00:00.000Z',
    ...overrides,
  };
}

function makePassage(id: string, overrides: Partial<FocusPassage> = {}): FocusPassage {
  return {
    id,
    book: 'JHN',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 14,
    createdAt: '2026-06-01T12:00:00.000Z',
    ...overrides,
  };
}

function makeParseHistory(overrides: Partial<ParseHistory> = {}): ParseHistory {
  return { correct: 8, total: 10, ...overrides };
}

describe('mergeSRSStores', () => {
  it('keeps cards present in only one store', () => {
    const merged = mergeSRSStores({ a: makeCard('a') }, { b: makeCard('b') });
    expect(Object.keys(merged).sort()).toEqual(['a', 'b']);
  });

  it('takes the card with the higher repetition', () => {
    const low = makeCard('a', { repetition: 1, interval: 1 });
    const high = makeCard('a', { repetition: 5, interval: 30 });
    expect(mergeSRSStores({ a: low }, { a: high }).a).toEqual(high);
    expect(mergeSRSStores({ a: high }, { a: low }).a).toEqual(high);
  });

  it('breaks repetition ties with the later dueDate', () => {
    const earlier = makeCard('a', { dueDate: '2026-06-10' });
    const later = makeCard('a', { dueDate: '2026-06-20' });
    expect(mergeSRSStores({ a: earlier }, { a: later }).a).toEqual(later);
    expect(mergeSRSStores({ a: later }, { a: earlier }).a).toEqual(later);
  });

  it('keeps the first store entry when repetition and dueDate are identical', () => {
    const cardA = makeCard('a', { easeFactor: 2.5 });
    const cardB = makeCard('a', { easeFactor: 2.1 });
    expect(mergeSRSStores({ a: cardA }, { a: cardB }).a).toEqual(cardA);
  });

  it('merges empty stores', () => {
    expect(mergeSRSStores({}, {})).toEqual({});
  });
});

describe('mergeStudyStats', () => {
  it('takes the max of the lifetime counters, and the larger streak on a tied anchor', () => {
    const a = makeStats({ streak: 7, totalReviewed: 50, totalCorrect: 90 });
    const b = makeStats({ streak: 2, totalReviewed: 200, totalCorrect: 40 });
    const merged = mergeStudyStats(a, b);
    expect(merged.streak).toBe(7);
    expect(merged.totalReviewed).toBe(200);
    expect(merged.totalCorrect).toBe(90);
  });

  it('takes daily fields from the store that studied most recently', () => {
    const stale = makeStats({
      totalReviewed: 50,
      cardsStudiedToday: 1,
      lastStudyDate: '2026-06-01',
    });
    const active = makeStats({
      totalReviewed: 200,
      cardsStudiedToday: 9,
      lastStudyDate: '2026-06-09',
    });
    const merged = mergeStudyStats(stale, active);
    expect(merged.cardsStudiedToday).toBe(9);
    expect(merged.lastStudyDate).toBe('2026-06-09');
  });

  it('keeps the streak consistent with its anchor date', () => {
    const a = makeStats({ streak: 7, lastStreakDate: '2026-06-09', totalReviewed: 50 });
    const b = makeStats({ streak: 2, lastStreakDate: '2026-05-01', totalReviewed: 200 });
    const merged = mergeStudyStats(a, b);
    expect(merged.streak).toBe(7);
    expect(merged.lastStreakDate).toBe('2026-06-09');
  });

  it('a stale high streak does not beat a live lower one', () => {
    // The regression: picking the larger streak dragged its month-old anchor
    // along, and loadStats() then zeroed the whole thing because the anchor was
    // neither today nor yesterday — a stale device silently ate a live streak.
    const stale = makeStats({ streak: 12, lastStreakDate: '2026-05-01', totalReviewed: 500 });
    const live = makeStats({ streak: 3, lastStreakDate: '2026-06-09', totalReviewed: 40 });

    const merged = mergeStudyStats(live, stale);
    expect(merged.streak).toBe(3);
    expect(merged.lastStreakDate).toBe('2026-06-09');
    expect(mergeStudyStats(stale, live)).toEqual(merged);
  });

  it('a stale but busier device does not supply the daily fields', () => {
    // Same failure one field over: most lifetime reviews is not "studied today".
    const stale = makeStats({
      totalReviewed: 500,
      cardsStudiedToday: 30,
      lastStudyDate: '2026-05-01',
    });
    const live = makeStats({
      totalReviewed: 40,
      cardsStudiedToday: 6,
      lastStudyDate: '2026-06-09',
    });

    const merged = mergeStudyStats(stale, live);
    expect(merged.cardsStudiedToday).toBe(6);
    expect(merged.lastStudyDate).toBe('2026-06-09');
    // The lifetime counter still takes the max — that part was never wrong.
    expect(merged.totalReviewed).toBe(500);
  });

  it('breaks a date tie on the larger counter', () => {
    const a = makeStats({ streak: 4, lastStreakDate: '2026-06-09' });
    const b = makeStats({ streak: 9, lastStreakDate: '2026-06-09' });

    expect(mergeStudyStats(a, b).streak).toBe(9);
    expect(mergeStudyStats(b, a).streak).toBe(9);
  });

  it('a device that has never hit the threshold cannot win the streak', () => {
    const never = makeStats({ streak: 0, lastStreakDate: '', totalReviewed: 900 });
    const some = makeStats({ streak: 2, lastStreakDate: '2026-06-08', totalReviewed: 20 });

    expect(mergeStudyStats(never, some).streak).toBe(2);
    expect(mergeStudyStats(some, never).streak).toBe(2);
  });

  it('is symmetric when date and magnitude disagree', () => {
    // The case the old rule got wrong; symmetry must survive the new tiebreak.
    const a = makeStats({
      streak: 12,
      lastStreakDate: '2026-05-01',
      lastStudyDate: '2026-05-01',
      totalReviewed: 500,
      totalCorrect: 400,
    });
    const b = makeStats({
      streak: 3,
      lastStreakDate: '2026-06-09',
      lastStudyDate: '2026-06-09',
      totalReviewed: 40,
      totalCorrect: 30,
    });

    expect(mergeStudyStats(a, b)).toEqual(mergeStudyStats(b, a));
  });

  it('is symmetric for the counter fields', () => {
    const a = makeStats({ streak: 7, totalReviewed: 50 });
    const b = makeStats({ streak: 2, totalReviewed: 200 });
    const ab = mergeStudyStats(a, b);
    const ba = mergeStudyStats(b, a);
    expect(ab.streak).toBe(ba.streak);
    expect(ab.totalReviewed).toBe(ba.totalReviewed);
    expect(ab.totalCorrect).toBe(ba.totalCorrect);
  });
});

describe('mergeCustomDecks', () => {
  it('unions decks by id', () => {
    const merged = mergeCustomDecks([makeDeck('1')], [makeDeck('2')]);
    expect(merged.map((d) => d.id).sort()).toEqual(['1', '2']);
  });

  it('resolves duplicate ids by the later createdAt', () => {
    const older = makeDeck('1', { name: 'Old name', createdAt: '2026-05-01T00:00:00.000Z' });
    const newer = makeDeck('1', { name: 'New name', createdAt: '2026-06-01T00:00:00.000Z' });
    expect(mergeCustomDecks([older], [newer])).toEqual([newer]);
    expect(mergeCustomDecks([newer], [older])).toEqual([newer]);
  });

  it('merges empty lists', () => {
    expect(mergeCustomDecks([], [])).toEqual([]);
  });
});

describe('mergeFocusPassages', () => {
  it('unions passages by id', () => {
    const merged = mergeFocusPassages([makePassage('p1')], [makePassage('p2')]);
    expect(merged.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('resolves duplicate ids by the later createdAt', () => {
    const older = makePassage('p1', { label: 'Old', createdAt: '2026-05-01T00:00:00.000Z' });
    const newer = makePassage('p1', { label: 'New', createdAt: '2026-06-01T00:00:00.000Z' });
    expect(mergeFocusPassages([older], [newer])).toEqual([newer]);
    expect(mergeFocusPassages([newer], [older])).toEqual([newer]);
  });

  it('keeps the first entry when createdAt values are identical', () => {
    const a = makePassage('p1', { label: 'A' });
    const b = makePassage('p1', { label: 'B' });
    expect(mergeFocusPassages([a], [b])).toEqual([a]);
  });

  it('merges empty lists', () => {
    expect(mergeFocusPassages([], [])).toEqual([]);
  });
});

describe('mergeParseHistory', () => {
  it('keeps entries present in only one store', () => {
    const merged = mergeParseHistory({ p1: makeParseHistory() }, { p2: makeParseHistory() });
    expect(Object.keys(merged).sort()).toEqual(['p1', 'p2']);
  });

  it('takes the entry with the higher total', () => {
    const few = makeParseHistory({ correct: 5, total: 10 });
    const more = makeParseHistory({ correct: 18, total: 20 });
    expect(mergeParseHistory({ p1: few }, { p1: more }).p1).toEqual(more);
    expect(mergeParseHistory({ p1: more }, { p1: few }).p1).toEqual(more);
  });

  it('breaks total ties with the higher correct count', () => {
    const lower = makeParseHistory({ correct: 7, total: 10 });
    const higher = makeParseHistory({ correct: 9, total: 10 });
    expect(mergeParseHistory({ p1: lower }, { p1: higher }).p1).toEqual(higher);
    expect(mergeParseHistory({ p1: higher }, { p1: lower }).p1).toEqual(higher);
  });

  it('keeps the first entry when total and correct are identical', () => {
    const a = makeParseHistory({ correct: 8, total: 10 });
    const b = makeParseHistory({ correct: 8, total: 10 });
    expect(mergeParseHistory({ p1: a }, { p1: b }).p1).toEqual(a);
  });

  it('merges empty stores', () => {
    expect(mergeParseHistory({}, {})).toEqual({});
  });
});

describe('mergeProgress', () => {
  it('merges all five sections', () => {
    const local = {
      srsStore: { a: makeCard('a', { repetition: 5 }) },
      studyStats: makeStats({ streak: 7 }),
      customDecks: [makeDeck('1')],
      focusPassages: [makePassage('p1')],
      parseHistory: { p1: makeParseHistory({ total: 20 }) },
    };
    const remote = {
      srsStore: { b: makeCard('b') },
      studyStats: makeStats({ totalReviewed: 500 }),
      customDecks: [makeDeck('2')],
      focusPassages: [makePassage('p2')],
      parseHistory: { p1: makeParseHistory({ total: 10 }), p2: makeParseHistory() },
    };

    const merged = mergeProgress(local, remote);
    expect(Object.keys(merged.srsStore).sort()).toEqual(['a', 'b']);
    expect(merged.studyStats.streak).toBe(7);
    expect(merged.studyStats.totalReviewed).toBe(500);
    expect(merged.customDecks).toHaveLength(2);
    expect(merged.focusPassages.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    // local p1 had total 20, remote had 10 — local wins
    expect(merged.parseHistory['p1']?.total).toBe(20);
    expect(merged.parseHistory['p2']).toBeDefined();
  });
});
