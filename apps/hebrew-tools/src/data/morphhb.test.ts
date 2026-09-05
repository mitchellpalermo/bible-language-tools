import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stripCantillation as stripCantillationInBuild } from '../../scripts/lib/oshb.mjs';
import { stripCantillation } from '../lib/hebrew-input';
import {
  clearMorphhbCache,
  DEFAULT_READER_PREFS,
  displayText,
  fetchBook,
  fetchBooks,
  fetchLemmas,
  type HebrewWord,
  isAramaic,
  loadLastPassage,
  loadReaderPrefs,
  morphemes,
  READER_PREFS_KEY,
  readingText,
  saveLastPassage,
  saveReaderPrefs,
} from './morphhb';

const word = (over: Partial<HebrewWord> = {}): HebrewWord => ({
  text: 'וַ/יְהִ֗י',
  lemma: '1961',
  pos: 'Vq',
  parsing: 'HC/Vqw3ms',
  ...over,
});

describe('displayText', () => {
  it('drops the morpheme boundaries', () => {
    expect(displayText(word())).toBe('וַיְהִ֗י');
  });

  it('leaves an unsegmented word alone', () => {
    expect(displayText({ text: 'אֱלֹהִ֑ים' })).toBe('אֱלֹהִ֑ים');
  });
});

describe('readingText', () => {
  it('shows the written form when there is no variant', () => {
    expect(readingText(word())).toBe('וַיְהִ֗י');
  });

  it('prefers the qere where the text is read differently than written', () => {
    const w = word({ text: 'לודיים', qere: 'לוּדִ֧ים', ketiv: true });
    expect(readingText(w)).toBe('לוּדִ֧ים');
  });

  it('drops boundaries from the qere too', () => {
    const w = word({ text: 'ל/עבדי/ך', qere: 'לְ/עַבְדָ֖/ךְ', ketiv: true });
    expect(readingText(w)).toBe('לְעַבְדָ֖ךְ');
  });
});

describe('morphemes', () => {
  it('pairs each morpheme with its own morph code', () => {
    expect(morphemes(word())).toEqual([
      { text: 'וַ', morph: 'C' },
      { text: 'יְהִ֗י', morph: 'Vqw3ms' },
    ]);
  });

  it('handles a three-morpheme stack', () => {
    expect(morphemes({ text: 'וְ/אִשְׁתּ֖/וֹ', parsing: 'HC/Ncfsc/Sp3ms' }).map((m) => m.morph)).toEqual([
      'C',
      'Ncfsc',
      'Sp3ms',
    ]);
  });

  it('strips the Aramaic language marker as readily as the Hebrew one', () => {
    expect(morphemes({ text: 'מַלְכָּ/א֙', parsing: 'ANcmsd/Td' })).toEqual([
      { text: 'מַלְכָּ', morph: 'Ncmsd' },
      { text: 'א֙', morph: 'Td' },
    ]);
  });

  it('pairs only as far as both lists reach, rather than misaligning them', () => {
    expect(morphemes({ text: 'אָב/וֹ/ת', parsing: 'HNcmpa' })).toEqual([
      { text: 'אָב', morph: 'Ncmpa' },
    ]);
  });
});

describe('isAramaic', () => {
  it('reads the language marker', () => {
    expect(isAramaic({ parsing: 'ANcmsd/Td' })).toBe(true);
    expect(isAramaic({ parsing: 'HC/Vqw3ms' })).toBe(false);
  });
});

describe('stripping cantillation', () => {
  // The build script cannot import the TypeScript, so it carries its own copy of
  // the mark set. These two drifting apart would mean the lexical forms in
  // lemmas.json were normalized differently from the running text on screen.
  const samples = ['בְּרֵאשִׁ֖ית', 'אַבְדָ֑ן', 'וְ/אִשְׁתּ֖/וֹ', 'שְׁנֵֽי־בָנָ֣יו׃', 'שָׁלוֹם', ''];

  // Behaviour is covered where the function lives, in `hebrew-input.test.ts`.
  it('agrees with the build script’s copy on every sample', () => {
    for (const sample of samples) {
      expect(stripCantillation(sample)).toBe(stripCantillationInBuild(sample));
    }
  });
});

describe('fetching', () => {
  beforeEach(() => {
    clearMorphhbCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (body: unknown, ok = true, status = 200) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('fetches a book by its code', async () => {
    const fetchMock = stubFetch({ '1': { '1': [word()] } });
    const book = await fetchBook('GEN');
    expect(fetchMock).toHaveBeenCalledWith('/data/morphhb/GEN.json');
    expect(book['1']['1']).toHaveLength(1);
  });

  it('serves a second read of the same book from cache', async () => {
    const fetchMock = stubFetch({ '1': { '1': [] } });
    await fetchBook('GEN');
    await fetchBook('GEN');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches the books index and the lemma index too', async () => {
    const fetchMock = stubFetch([]);
    await fetchBooks();
    await fetchBooks();
    await fetchLemmas();
    await fetchLemmas();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws with the status when a fetch fails', async () => {
    stubFetch(null, false, 404);
    await expect(fetchBook('XXX')).rejects.toThrow('HTTP 404');
    await expect(fetchBooks()).rejects.toThrow('HTTP 404');
    await expect(fetchLemmas()).rejects.toThrow('HTTP 404');
  });
});

describe('reading position', () => {
  it('round-trips through localStorage', () => {
    saveLastPassage('GEN.1');
    expect(loadLastPassage()).toBe('GEN.1');
  });

  it('returns null when nothing is stored', () => {
    localStorage.clear();
    expect(loadLastPassage()).toBeNull();
  });

  it('survives localStorage throwing', () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => saveLastPassage('GEN.1')).not.toThrow();
    expect(loadLastPassage()).toBeNull();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('reading preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // The WLC is an accented text, and a student who has never met te'amim is
  // better served meeting them and turning them off.
  it('shows the accents and the highlighting until told otherwise', () => {
    expect(loadReaderPrefs()).toEqual({ cantillation: true, studied: true });
    expect(loadReaderPrefs()).toEqual(DEFAULT_READER_PREFS);
  });

  it('round-trips through localStorage', () => {
    saveReaderPrefs({ cantillation: false, studied: false });
    expect(loadReaderPrefs()).toEqual({ cantillation: false, studied: false });
  });

  it('fills in a preference a stored payload does not carry', () => {
    localStorage.setItem(READER_PREFS_KEY, JSON.stringify({ cantillation: false }));
    expect(loadReaderPrefs()).toEqual({ cantillation: false, studied: true });
  });

  it('falls back rather than throwing on a payload that will not parse', () => {
    localStorage.setItem(READER_PREFS_KEY, 'not json');
    expect(loadReaderPrefs()).toEqual(DEFAULT_READER_PREFS);
  });

  it('survives localStorage throwing', () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => saveReaderPrefs(DEFAULT_READER_PREFS)).not.toThrow();
    expect(loadReaderPrefs()).toEqual(DEFAULT_READER_PREFS);
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
