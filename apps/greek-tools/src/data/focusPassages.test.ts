import { beforeEach, describe, expect, it } from 'vitest';
import {
  deletePassage,
  type FocusPassage,
  generateId,
  getMaturityLevel,
  getParseGrade,
  getVocabMaturityBreakdown,
  loadFocusPassages,
  loadParseHistoryStore,
  type MaturityBreakdown,
  recordParseSession,
  saveFocusPassages,
  saveParseHistoryStore,
} from './focusPassages';
import type { SRSCard } from './srs';

// ─── helpers ────────────────────────────────────────────────────────────────

function makePassage(overrides: Partial<FocusPassage> = {}): FocusPassage {
  return {
    id: 'test-id',
    book: 'REV',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 11,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCard(interval: number): SRSCard {
  return {
    key: 'test',
    interval,
    repetition: interval > 0 ? 1 : 0,
    easeFactor: 2.5,
    dueDate: '2099-01-01',
    lastReviewed: '2026-01-01',
  };
}

beforeEach(() => {
  localStorage.clear();
});

// ─── loadFocusPassages / saveFocusPassages ───────────────────────────────────

describe('loadFocusPassages', () => {
  it('returns empty array when nothing saved', () => {
    expect(loadFocusPassages()).toEqual([]);
  });

  it('returns saved passages', () => {
    const passages = [makePassage({ id: 'a' }), makePassage({ id: 'b' })];
    saveFocusPassages(passages);
    expect(loadFocusPassages()).toEqual(passages);
  });

  it('returns empty array on corrupt data', () => {
    localStorage.setItem('greek-tools-focus-passages-v1', 'not-json');
    expect(loadFocusPassages()).toEqual([]);
  });
});

// ─── loadParseHistoryStore / saveParseHistoryStore ───────────────────────────

describe('loadParseHistoryStore', () => {
  it('returns empty object when nothing saved', () => {
    expect(loadParseHistoryStore()).toEqual({});
  });

  it('returns saved store', () => {
    const store = { 'test-id': { correct: 8, total: 10 } };
    saveParseHistoryStore(store);
    expect(loadParseHistoryStore()).toEqual(store);
  });

  it('returns empty object on corrupt data', () => {
    localStorage.setItem('greek-tools-focus-parse-v1', '{bad');
    expect(loadParseHistoryStore()).toEqual({});
  });
});

// ─── recordParseSession ──────────────────────────────────────────────────────

describe('recordParseSession', () => {
  it('creates a new entry for a new passage id', () => {
    recordParseSession('p1', 8, 10);
    expect(loadParseHistoryStore()['p1']).toEqual({ correct: 8, total: 10 });
  });

  it('accumulates correct and total across sessions', () => {
    recordParseSession('p1', 8, 10);
    recordParseSession('p1', 7, 10);
    expect(loadParseHistoryStore()['p1']).toEqual({ correct: 15, total: 20 });
  });

  it('does not affect other passage ids', () => {
    recordParseSession('p1', 5, 10);
    recordParseSession('p2', 3, 10);
    expect(loadParseHistoryStore()['p1']).toEqual({ correct: 5, total: 10 });
  });
});

// ─── deletePassage ───────────────────────────────────────────────────────────

describe('deletePassage', () => {
  it('removes the passage from the list', () => {
    saveFocusPassages([makePassage({ id: 'a' }), makePassage({ id: 'b' })]);
    deletePassage('a');
    const remaining = loadFocusPassages();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('b');
  });

  it('removes its parse history', () => {
    saveParseHistoryStore({ a: { correct: 5, total: 10 }, b: { correct: 3, total: 5 } });
    deletePassage('a');
    const store = loadParseHistoryStore();
    expect(store['a']).toBeUndefined();
    expect(store['b']).toEqual({ correct: 3, total: 5 });
  });

  it('is a no-op for unknown ids', () => {
    saveFocusPassages([makePassage({ id: 'a' })]);
    deletePassage('unknown');
    expect(loadFocusPassages()).toHaveLength(1);
  });
});

// ─── getMaturityLevel ────────────────────────────────────────────────────────

describe('getMaturityLevel', () => {
  it('returns 0 for interval 0 (unseen)', () => {
    expect(getMaturityLevel(0)).toBe(0);
  });

  it('returns 1 for interval 1–5 (learning)', () => {
    expect(getMaturityLevel(1)).toBe(1);
    expect(getMaturityLevel(5)).toBe(1);
  });

  it('returns 2 for interval 6–20 (familiar)', () => {
    expect(getMaturityLevel(6)).toBe(2);
    expect(getMaturityLevel(20)).toBe(2);
  });

  it('returns 3 for interval 21+ (mature)', () => {
    expect(getMaturityLevel(21)).toBe(3);
    expect(getMaturityLevel(100)).toBe(3);
  });
});

// ─── getVocabMaturityBreakdown ───────────────────────────────────────────────

describe('getVocabMaturityBreakdown', () => {
  it('counts unseen lemmas (no card)', () => {
    const result: MaturityBreakdown = getVocabMaturityBreakdown(['καί', 'ὁ'], {});
    expect(result.unseen).toBe(2);
    expect(result.learning).toBe(0);
  });

  it('correctly categorises cards by interval', () => {
    const store: Record<string, SRSCard> = {
      λόγος: makeCard(0),
      καί: makeCard(3),
      ὁ: makeCard(15),
      θεός: makeCard(30),
    };
    const result = getVocabMaturityBreakdown(['λόγος', 'καί', 'ὁ', 'θεός'], store);
    expect(result.unseen).toBe(1);
    expect(result.learning).toBe(1);
    expect(result.familiar).toBe(1);
    expect(result.mature).toBe(1);
  });

  it('returns zeroes for empty lemma list', () => {
    const result = getVocabMaturityBreakdown([], {});
    expect(result).toEqual({ mature: 0, familiar: 0, learning: 0, unseen: 0 });
  });
});

// ─── getParseGrade ───────────────────────────────────────────────────────────

describe('getParseGrade', () => {
  it('returns — when no history', () => {
    expect(getParseGrade('missing')).toBe('—');
  });

  it('returns — when total is 0', () => {
    saveParseHistoryStore({ p: { correct: 0, total: 0 } });
    expect(getParseGrade('p')).toBe('—');
  });

  it('returns A for ≥ 90%', () => {
    saveParseHistoryStore({ p: { correct: 9, total: 10 } });
    expect(getParseGrade('p')).toBe('A');
  });

  it('returns B for 75–89%', () => {
    saveParseHistoryStore({ p: { correct: 8, total: 10 } });
    expect(getParseGrade('p')).toBe('B');
  });

  it('returns C for 60–74%', () => {
    saveParseHistoryStore({ p: { correct: 65, total: 100 } });
    expect(getParseGrade('p')).toBe('C');
  });

  it('returns D for 45–59%', () => {
    saveParseHistoryStore({ p: { correct: 5, total: 10 } });
    expect(getParseGrade('p')).toBe('D');
  });

  it('returns E for < 45%', () => {
    saveParseHistoryStore({ p: { correct: 4, total: 10 } });
    expect(getParseGrade('p')).toBe('E');
  });
});

// ─── generateId ─────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('generates non-empty strings', () => {
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 20 }, generateId));
    expect(ids.size).toBe(20);
  });
});
