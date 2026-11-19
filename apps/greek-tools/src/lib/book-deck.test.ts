import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data/morphgnt', () => ({ fetchBook: vi.fn() }));

vi.mock('../data/vocabulary', () => ({
  vocabulary: [
    { greek: 'ὁ, ἡ, τό', gloss: 'the', frequency: 19769, partOfSpeech: 'article' },
    { greek: 'καί', gloss: 'and, even, also', frequency: 8973, partOfSpeech: 'conjunction' },
    { greek: 'λόγος', gloss: 'word, message', frequency: 330, partOfSpeech: 'noun' },
  ],
}));

import { fetchBook } from '../data/morphgnt';
import { getBookDeck, getBookWordKeys, greekKeysOf, loadGreekSource } from './book-deck';

const mockFetchBook = vi.mocked(fetchBook);

function word(lemma: string) {
  return { text: lemma, lemma, pos: 'N-', parsing: '--------' };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getBookWordKeys', () => {
  it('returns unique vocab keys found in the book', async () => {
    mockFetchBook.mockResolvedValue({
      '1': {
        '1': [word('ὁ'), word('καί')],
        '2': [word('λόγος')],
      },
    });

    const keys = await getBookWordKeys('JHN');
    expect(keys).toHaveLength(3);
    expect(keys).toContain('ὁ');
    expect(keys).toContain('καί');
    expect(keys).toContain('λόγος');
  });

  it('deduplicates repeated lemmas across verses', async () => {
    mockFetchBook.mockResolvedValue({
      '1': {
        '1': [word('ὁ'), word('ὁ'), word('καί')],
        '2': [word('ὁ')],
      },
    });

    const keys = await getBookWordKeys('MAT');
    expect(keys.filter((k) => k === 'ὁ')).toHaveLength(1);
  });

  it('deduplicates repeated lemmas across chapters', async () => {
    mockFetchBook.mockResolvedValue({
      '1': { '1': [word('καί')] },
      '2': { '1': [word('καί')] },
      '3': { '1': [word('καί')] },
    });

    const keys = await getBookWordKeys('MAT');
    expect(keys).toHaveLength(1);
    expect(keys).toContain('καί');
  });

  it('skips lemmas not in the vocabulary', async () => {
    mockFetchBook.mockResolvedValue({
      '1': {
        '1': [word('Παῦλος'), word('καί')],
      },
    });

    const keys = await getBookWordKeys('PHM');
    expect(keys).toHaveLength(1);
    expect(keys).toContain('καί');
    expect(keys).not.toContain('Παῦλος');
  });

  it('returns an empty array for a book with no vocabulary matches', async () => {
    mockFetchBook.mockResolvedValue({
      '1': { '1': [word('Παῦλος'), word('Φιλήμων')] },
    });

    const keys = await getBookWordKeys('PHM');
    expect(keys).toHaveLength(0);
  });

  it('returns an empty array for an empty book', async () => {
    mockFetchBook.mockResolvedValue({});

    const keys = await getBookWordKeys('PHM');
    expect(keys).toHaveLength(0);
  });

  it('collects lemmas across many chapters and verses', async () => {
    mockFetchBook.mockResolvedValue({
      '1': { '1': [word('ὁ')] },
      '2': { '5': [word('καί')] },
      '3': { '10': [word('λόγος')] },
    });

    const keys = await getBookWordKeys('JHN');
    expect(keys).toHaveLength(3);
    expect(keys).toContain('ὁ');
    expect(keys).toContain('καί');
    expect(keys).toContain('λόγος');
  });

  it('propagates errors from fetchBook', async () => {
    mockFetchBook.mockRejectedValue(new Error('HTTP 404'));

    await expect(getBookWordKeys('PHM')).rejects.toThrow('HTTP 404');
  });
});

describe('getBookDeck', () => {
  it('records the whole book as the deck’s source (#270)', async () => {
    mockFetchBook.mockResolvedValue({
      '1': { '1': [word('ὁ')], '2': [word('καί')] },
      '2': { '1': [word('λόγος')], '9': [word('ὁ')] },
    });
    const { wordKeys, source } = await getBookDeck('JHN');
    expect(wordKeys.sort()).toEqual(['καί', 'λόγος', 'ὁ'].sort());
    expect(source).toEqual({
      book: 'JHN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 2,
      endVerse: 9,
    });
  });
});

describe('the word join for chapters and verses', () => {
  it('a word is an occurrence of its lemma’s card, and of nothing when there is none', () => {
    expect(greekKeysOf(word('λόγος'))).toEqual(['λόγος']);
    expect(greekKeysOf(word('Μελχισέδεκ'))).toEqual([]);
  });

  it('loads a book with that join', async () => {
    mockFetchBook.mockResolvedValue({ '1': { '1': [word('καί')] } });
    const loaded = await loadGreekSource('PHM');
    expect(mockFetchBook).toHaveBeenCalledWith('PHM');
    expect(loaded.keysOf).toBe(greekKeysOf);
  });
});
