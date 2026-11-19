import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildDeckSourceIndex,
  COMMON_WORD_THRESHOLD,
  createDeckChapterMemory,
  describeSource,
  normalizeDeckChapters,
  spansChapters,
  startsFolded,
  wholeBookSource,
  withDeckChapters,
} from './deck-source';

// A three-chapter book. A word is its own key unless it starts with '_' (no card).
const BOOK = {
  '1': { '1': ['a', 'b'], '2': ['c', 'a'], '3': ['_x'] },
  '2': { '1': ['b', 'd'], '2': ['a', 'a'] },
  '3': { '1': ['e'], '2': ['a'] },
};
const keysOf = (w: string) => (w.startsWith('_') ? [] : [w]);
const WHOLE = { book: 'TST', startChapter: 1, startVerse: 1, endChapter: 3, endVerse: 2 };

describe('buildDeckSourceIndex', () => {
  const index = buildDeckSourceIndex(BOOK, WHOLE, keysOf);

  it('lists every place a word occurs, in reading order, two in one verse included', () => {
    expect(index.occurrencesOf('a')).toEqual([
      { chapter: 1, verse: 1, position: 0 },
      { chapter: 1, verse: 2, position: 1 },
      { chapter: 2, verse: 2, position: 0 },
      { chapter: 2, verse: 2, position: 1 },
      { chapter: 3, verse: 2, position: 0 },
    ]);
    expect(index.occurrencesOf('zzz')).toEqual([]);
    expect(index.occurrencesOf('_x')).toEqual([]);
  });

  it('puts a word in every chapter it occurs in (#270, decision 1)', () => {
    expect(index.chapters).toEqual([1, 2, 3]);
    expect(index.chaptersOf('a')).toEqual([1, 2, 3]);
    expect(index.chaptersOf('d')).toEqual([2]);
    expect(index.chaptersOf('zzz')).toEqual([]);
  });

  it('counts each chapter’s words among the deck’s, once each', () => {
    expect(index.chapterStats(['a', 'b', 'd', 'd', 'hand-added'])).toEqual([
      { chapter: 1, total: 2 },
      { chapter: 2, total: 3 },
      { chapter: 3, total: 1 },
    ]);
  });

  it('no chapters is the whole deck; a word the text lacks is in no chapter', () => {
    expect(index.inChapters('hand-added', [])).toBe(true);
    expect(index.inChapters('hand-added', [1])).toBe(false);
    expect(index.inChapters('d', [1, 3])).toBe(false);
    expect(index.inChapters('d', [2])).toBe(true);
  });

  it('a passage that starts and ends mid-chapter is cut at its own verses', () => {
    const mid = buildDeckSourceIndex(
      BOOK,
      { book: 'TST', startChapter: 1, startVerse: 2, endChapter: 2, endVerse: 1 },
      keysOf,
    );
    expect(mid.chapters).toEqual([1, 2]);
    expect(mid.occurrencesOf('a')).toEqual([{ chapter: 1, verse: 2, position: 1 }]);
    expect(mid.chaptersOf('b')).toEqual([2]);
    expect(mid.occurrencesOf('e')).toEqual([]);
  });

  it('counts a word once per place even when keysOf repeats a key', () => {
    const twice = buildDeckSourceIndex({ '1': { '1': ['a'] } }, WHOLE, () => ['k', 'k']);
    expect(twice.occurrencesOf('k')).toHaveLength(1);
  });
});

describe('spansChapters', () => {
  it('is true only for a source over more than one chapter', () => {
    expect(spansChapters(WHOLE)).toBe(true);
    expect(spansChapters({ ...WHOLE, endChapter: 1 })).toBe(false);
    expect(spansChapters(undefined)).toBe(false);
    expect(spansChapters(null)).toBe(false);
  });
});

describe('the common-word fold', () => {
  it('folds only past the threshold', () => {
    expect(startsFolded(COMMON_WORD_THRESHOLD)).toBe(false);
    expect(startsFolded(COMMON_WORD_THRESHOLD + 1)).toBe(true);
  });
});

describe('chapters remembered per deck', () => {
  it('normalizes what storage holds', () => {
    expect(normalizeDeckChapters(null)).toEqual({});
    expect(normalizeDeckChapters([1])).toEqual({});
    expect(normalizeDeckChapters({ a: [3, 1, 1, 0, 2.5, 'x'], b: 'no', c: [] })).toEqual({
      a: [1, 3],
    });
  });

  it('sets one deck and drops it when it is the whole deck again', () => {
    const memory = withDeckChapters({ other: [2] }, 'd', [5, 4]);
    expect(memory).toEqual({ other: [2], d: [4, 5] });
    expect(withDeckChapters(memory, 'd', [])).toEqual({ other: [2] });
  });

  describe('createDeckChapterMemory', () => {
    const memory = createDeckChapterMemory('test-deck-chapters');
    beforeEach(() => localStorage.clear());

    it('round-trips and survives corrupt storage', () => {
      expect(memory.load()).toEqual({});
      memory.save({ d: [5] });
      expect(memory.load()).toEqual({ d: [5] });
      localStorage.setItem('test-deck-chapters', '{');
      expect(memory.load()).toEqual({});
    });

    it('a failed write does not throw', () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('full');
      };
      try {
        expect(() => memory.save({ d: [1] })).not.toThrow();
      } finally {
        Storage.prototype.setItem = original;
      }
    });
  });
});

describe('wholeBookSource', () => {
  it('runs from the first verse to the last', () => {
    expect(wholeBookSource('TST', BOOK)).toEqual(WHOLE);
    expect(wholeBookSource('PS', { '2': { '3': [], '1': [] }, '10': { '7': [] } })).toEqual({
      book: 'PS',
      startChapter: 2,
      startVerse: 1,
      endChapter: 10,
      endVerse: 7,
    });
  });

  it('is null for a book with no verses', () => {
    expect(wholeBookSource('X', {})).toBeNull();
    expect(wholeBookSource('X', { '1': {} })).toBeNull();
  });
});

describe('describeSource', () => {
  it('names a whole book by its name and a passage by its reference', () => {
    expect(describeSource(WHOLE, BOOK, 'Test')).toBe('Test');
    expect(describeSource({ ...WHOLE, endVerse: 1 }, BOOK, 'Test')).toBe('Test 1:1–3:1');
  });
});
