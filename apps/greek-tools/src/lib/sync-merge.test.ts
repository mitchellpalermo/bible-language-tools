import { describe, expect, it } from 'vitest';
import type { CustomDeck } from '../data/customDecks';
import type { SRSCard, StudyStats } from '../data/srs';
import { mergeCustomDecks, mergeProgress, mergeSRSStores, mergeStudyStats } from './sync-merge';

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
  it('takes the max of streak, totalReviewed, and totalCorrect', () => {
    const a = makeStats({ streak: 7, totalReviewed: 50, totalCorrect: 90 });
    const b = makeStats({ streak: 2, totalReviewed: 200, totalCorrect: 40 });
    const merged = mergeStudyStats(a, b);
    expect(merged.streak).toBe(7);
    expect(merged.totalReviewed).toBe(200);
    expect(merged.totalCorrect).toBe(90);
  });

  it('takes daily fields from the store with the higher totalReviewed', () => {
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

  it('keeps lastStreakDate consistent with the winning streak', () => {
    const a = makeStats({ streak: 7, lastStreakDate: '2026-06-09', totalReviewed: 50 });
    const b = makeStats({ streak: 2, lastStreakDate: '2026-05-01', totalReviewed: 200 });
    const merged = mergeStudyStats(a, b);
    expect(merged.streak).toBe(7);
    expect(merged.lastStreakDate).toBe('2026-06-09');
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

describe('mergeProgress', () => {
  it('merges all three sections', () => {
    const local = {
      srsStore: { a: makeCard('a', { repetition: 5 }) },
      studyStats: makeStats({ streak: 7 }),
      customDecks: [makeDeck('1')],
    };
    const remote = {
      srsStore: { b: makeCard('b') },
      studyStats: makeStats({ totalReviewed: 500 }),
      customDecks: [makeDeck('2')],
    };

    const merged = mergeProgress(local, remote);
    expect(Object.keys(merged.srsStore).sort()).toEqual(['a', 'b']);
    expect(merged.studyStats.streak).toBe(7);
    expect(merged.studyStats.totalReviewed).toBe(500);
    expect(merged.customDecks).toHaveLength(2);
  });
});
