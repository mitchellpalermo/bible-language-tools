import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data/morphhb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/morphhb')>()),
  fetchBook: vi.fn(),
  fetchLemmas: vi.fn(),
}));

import { fetchBook, fetchLemmas, type HebrewWord } from '../data/morphhb';
import { vocabulary } from '../data/vocabulary';
import { buildBookDeck, loadHebrewSource } from './book-deck';
import { passageWordKey } from './focus-passages';

const word = (lemma: string): HebrewWord => ({ text: 'x', lemma, pos: 'Nc', parsing: 'HNcmsa' });

// Two course words with a Strong's number, wherever they are in the vocabulary.
const [A, B] = vocabulary
  .filter((w) => /^\d/.test(w.strong ?? '') && w.frequency !== undefined)
  .slice(0, 2);
const BOOK = {
  '1': { '1': [word(A.strong as string), word('99998')] },
  '2': { '3': [word(B.strong as string), word('99999')] },
};

beforeEach(() => {
  vi.mocked(fetchBook).mockReset().mockResolvedValue(BOOK);
  vi.mocked(fetchLemmas).mockReset().mockResolvedValue({});
});

describe('buildBookDeck', () => {
  it('holds the book’s course words, one card a lexeme, with the whole book as its source', async () => {
    const { wordKeys, source } = await buildBookDeck('RUT');
    expect(wordKeys.sort()).toEqual([passageWordKey(A), passageWordKey(B)].sort());
    expect(source).toEqual({
      book: 'RUT',
      startChapter: 1,
      startVerse: 1,
      endChapter: 2,
      endVerse: 3,
    });
  });

  it('still reads the book when the lemma index will not load', async () => {
    vi.mocked(fetchLemmas).mockRejectedValue(new Error('offline'));
    expect((await buildBookDeck('RUT')).wordKeys).toHaveLength(2);
  });

  it('an empty book makes no deck source', async () => {
    vi.mocked(fetchBook).mockResolvedValue({});
    expect(await buildBookDeck('RUT')).toEqual({ wordKeys: [], source: null });
  });
});

describe('loadHebrewSource', () => {
  it('pairs the book with the course join', async () => {
    const { book, keysOf } = await loadHebrewSource('RUT');
    expect(book).toBe(BOOK);
    expect(keysOf(word(A.strong as string))).toContain(passageWordKey(A));
    expect(keysOf(word('99998'))).toEqual([]);
  });
});
