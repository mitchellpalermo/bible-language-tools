import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HebrewBook, HebrewWord } from '../data/morphhb';
import {
  bhsBookName,
  buildHebrewPDF,
  DEFAULT_EXPORT_OPTIONS,
  exportFilename,
  exportText,
  extractVerses,
  formatPassageRef,
  lastVerse,
  loadHebrewFont,
  loadLatinFont,
  normalizeRange,
  toExportVerses,
} from './pdf-export';

const FONT = new Uint8Array(
  readFileSync(resolve(__dirname, '../../public/fonts/NotoSansHebrew-Regular.ttf')),
);

function word(text: string, extra: Partial<HebrewWord> = {}): HebrewWord {
  return { text, lemma: 'x', pos: 'Nc', parsing: 'HNcmsa', ...extra };
}

const BOOK: HebrewBook = {
  '1': {
    '1': [word('בְּ/רֵאשִׁ֖ית'), word('בָּרָ֣א')],
    '2': [word('וְ/הָ/אָ֗רֶץ')],
    '3': [word('וַ/יֹּ֥אמֶר')],
  },
  '2': {
    '1': [word('וַ/יְכֻלּ֛וּ')],
    '5': [word('וְ/כֹ֣ל')],
  },
};

const RANGE = { book: 'GEN', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 3 };

const BOOKS_JSON = resolve(__dirname, '../../public/data/morphhb/books.json');
const LATIN = new Uint8Array(
  readFileSync(resolve(__dirname, '../../public/fonts/NotoSans-Regular.ttf')),
);

afterEach(() => vi.unstubAllGlobals());

describe('extractVerses', () => {
  it('returns a range inside one chapter, in verse order', () => {
    expect(extractVerses(BOOK, { ...RANGE, startVerse: 2 }).map((v) => v.verse)).toEqual([2, 3]);
    expect(extractVerses(BOOK, { ...RANGE, endVerse: 2 }).map((v) => v.verse)).toEqual([1, 2]);
  });

  it('applies the start verse to the first chapter and the end verse to the last', () => {
    const got = extractVerses(BOOK, { ...RANGE, startVerse: 3, endChapter: 2, endVerse: 1 });
    expect(got.map((v) => [v.chapter, v.verse])).toEqual([
      [1, 3],
      [2, 1],
    ]);
  });

  it('skips a chapter the book lacks and returns nothing for a missing range', () => {
    expect(extractVerses(BOOK, { ...RANGE, startChapter: 7, endChapter: 9 })).toEqual([]);
    expect(extractVerses({ '1': { '1': [] } }, { ...RANGE, endChapter: 2 })).toHaveLength(1);
  });

  it('carries the words of each verse', () => {
    expect(extractVerses(BOOK, RANGE)[0].words).toHaveLength(2);
  });
});

describe('lastVerse', () => {
  it('is the highest verse number, not the count', () => {
    expect(lastVerse(BOOK, 2)).toBe(5);
  });

  it('is 1 when the chapter or the book is not known', () => {
    expect(lastVerse(BOOK, 99)).toBe(1);
    expect(lastVerse(null, 1)).toBe(1);
  });
});

describe('normalizeRange', () => {
  it('leaves a coherent range alone', () => {
    expect(normalizeRange(RANGE, BOOK)).toEqual(RANGE);
  });

  it('lifts an end that falls before the start in the same chapter', () => {
    expect(normalizeRange({ ...RANGE, startVerse: 3, endVerse: 1 }, BOOK).endVerse).toBe(3);
  });

  it('keeps the end after the start when the chapters differ', () => {
    const r = normalizeRange({ ...RANGE, startChapter: 2, endChapter: 1, endVerse: 1 }, BOOK);
    expect(r.endChapter).toBe(2);
  });

  it('clamps verses to the chapter they are in', () => {
    const r = normalizeRange({ ...RANGE, startVerse: 40, endVerse: 40 }, BOOK);
    expect(r.startVerse).toBe(3);
    expect(r.endVerse).toBe(3);
  });

  it('does not clamp before the book has loaded', () => {
    expect(normalizeRange({ ...RANGE, endVerse: 9 }, null).endVerse).toBe(9);
  });
});

describe('formatPassageRef', () => {
  it('names a verse, a span in a chapter, and a span across chapters', () => {
    expect(formatPassageRef('Genesis', { ...RANGE, endVerse: 1 })).toBe('Genesis 1:1');
    expect(formatPassageRef('Genesis', RANGE)).toBe('Genesis 1:1–3');
    expect(formatPassageRef('Genesis', { ...RANGE, endChapter: 2, endVerse: 4 })).toBe(
      'Genesis 1:1–2:4',
    );
  });
});

describe('exportFilename', () => {
  it('makes a safe name from a reference', () => {
    expect(exportFilename('1 Samuel 3:1–10')).toBe('1-Samuel-3-1-10-hebrew.pdf');
  });

  it('has a name even when nothing usable is left', () => {
    expect(exportFilename('—')).toBe('passage-hebrew.pdf');
  });
});

describe('exportText', () => {
  const w = word('בְּ/רֵאשִׁ֖ית');

  it('prints the pointed and accented text without morpheme slashes', () => {
    expect(exportText(w, DEFAULT_EXPORT_OPTIONS)).toBe('בְּרֵאשִׁ֖ית');
  });

  it('drops the accents but keeps the vowels', () => {
    expect(exportText(w, { pointing: 'pointed', cantillation: false })).toBe('בְּרֵאשִׁית');
  });

  it('drops points and accents for consonants only, whatever the cantillation setting', () => {
    for (const cantillation of [true, false]) {
      expect(exportText(w, { pointing: 'consonants', cantillation })).toBe('בראשית');
    }
  });

  it('removes the shin and sin dots with the other points', () => {
    expect(exportText(word('שִׁ֖ין'), { pointing: 'consonants', cantillation: true })).toBe('שין');
    expect(exportText(word('שִׂ֖ים'), { pointing: 'consonants', cantillation: true })).toBe('שים');
  });

  it('prints the qere where the reading differs from the writing', () => {
    const qere = word('היא', { ketiv: true, qere: 'הִ֑יא' });
    expect(exportText(qere, DEFAULT_EXPORT_OPTIONS)).toBe('הִ֑יא');
  });
});

describe('toExportVerses', () => {
  it('prints a maqqef-joined unit as one token, with the maqqef', () => {
    const verses = [
      {
        chapter: 1,
        verse: 1,
        words: [word('עַל', { after: '־' }), word('כֵּ֣ן'), word('בָּרָ֣א', { after: '׃' })],
      },
    ];
    const [v] = toExportVerses(verses, DEFAULT_EXPORT_OPTIONS);
    expect(v.words).toEqual(['עַל־כֵּ֣ן', 'בָּרָ֣א׃']);
  });

  it('keeps the maqqef when the points are stripped', () => {
    const verses = [{ chapter: 1, verse: 1, words: [word('עַל', { after: '־' }), word('כֵּ֣ן')] }];
    const [v] = toExportVerses(verses, { pointing: 'consonants', cantillation: true });
    expect(v.words).toEqual(['על־כן']);
  });

  it('keeps chapter and verse numbers', () => {
    expect(toExportVerses([{ chapter: 4, verse: 9, words: [] }], DEFAULT_EXPORT_OPTIONS)).toEqual([
      { chapter: 4, verse: 9, words: [] },
    ]);
  });
});

describe('loadHebrewFont', () => {
  function stubFetch(body: Uint8Array, ok = true, status = 200) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok,
        status,
        arrayBuffer: () =>
          Promise.resolve(
            body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
          ),
      }),
    );
  }

  it('returns the font bytes', async () => {
    stubFetch(FONT);
    expect((await loadHebrewFont()).length).toBe(FONT.length);
    expect(fetch).toHaveBeenCalledWith('/fonts/NotoSansHebrew-Regular.ttf');
  });

  it('accepts an OpenType file', async () => {
    stubFetch(new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0]));
    await expect(loadHebrewFont()).resolves.toBeInstanceOf(Uint8Array);
  });

  it('fails on an HTTP error', async () => {
    stubFetch(new Uint8Array(), false, 404);
    await expect(loadHebrewFont()).rejects.toThrow(/HTTP 404/);
  });

  it('fails on a page that is not a font, answered with HTTP 200', async () => {
    stubFetch(new TextEncoder().encode('<!doctype html><title>Not found</title>'));
    await expect(loadHebrewFont()).rejects.toThrow(/did not load/);
  });
});

describe('bhsBookName', () => {
  it('prints a pointed name as BHS does: consonants and shin dots', () => {
    expect(bhsBookName('בְּרֵאשִׁית')).toBe('בראשׁית');
    expect(bhsBookName('שִׁיר הַשִּׁירִים')).toBe('שׁיר השׁירים');
    expect(bhsBookName('יְשַׁעְיָהוּ')).toBe('ישׁעיהו');
  });

  it('keeps the two-part names whole, with their letter', () => {
    expect(bhsBookName('שְׁמוּאֵל א')).toBe('שׁמואל א');
    expect(bhsBookName('דִּבְרֵי הַיָּמִים ב')).toBe('דברי הימים ב');
  });

  it('keeps the sin dot and leaves bare text alone', () => {
    expect(bhsBookName('שֹׂ')).toBe('שׂ');
    expect(bhsBookName('רות')).toBe('רות');
  });

  it.skipIf(!existsSync(BOOKS_JSON))(
    'is the book list with only marks removed, for every book',
    () => {
      const books = JSON.parse(readFileSync(BOOKS_JSON, 'utf8')) as { hebrew: string }[];
      for (const { hebrew } of books) {
        const bare = bhsBookName(hebrew);
        expect(bare.replace(/[\u05C1\u05C2]/g, '')).toBe(hebrew.replace(/[\u0591-\u05C7]/g, ''));
      }
    },
  );
});

describe('loadLatinFont', () => {
  it('loads the Latin face the headings use', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () =>
          Promise.resolve(
            LATIN.buffer.slice(LATIN.byteOffset, LATIN.byteOffset + LATIN.byteLength),
          ),
      }),
    );
    expect((await loadLatinFont()).length).toBe(LATIN.length);
    expect(fetch).toHaveBeenCalledWith('/fonts/NotoSans-Regular.ttf');
  });
});

describe('buildHebrewPDF', () => {
  function stubFonts() {
    const bytes = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(bytes(url.includes('Hebrew') ? FONT : LATIN)),
        }),
      ),
    );
  }

  it('builds a PDF with the Hebrew face for the text and the Latin face for the headings', async () => {
    stubFonts();
    const verses = extractVerses(BOOK, RANGE);
    const bytes = await buildHebrewPDF(verses, 'Genesis 1:1–3', DEFAULT_EXPORT_OPTIONS, 'בְּרֵאשִׁית');
    const text = Buffer.from(bytes).toString('latin1');
    expect(text.slice(0, 5)).toBe('%PDF-');
    expect(text).toMatch(/\/BaseFont\s*\/\w*NotoSansHebrew/);
    expect(text).toMatch(/\/BaseFont\s*\/\w*NotoSans-Regular/);
    expect(text).not.toMatch(/\/BaseFont\s*\/Helvetica/);
    expect(text.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  });

  it('builds without a book name', async () => {
    stubFonts();
    await expect(
      buildHebrewPDF(extractVerses(BOOK, RANGE), 'Genesis 1:1–3', DEFAULT_EXPORT_OPTIONS),
    ).resolves.toBeInstanceOf(Uint8Array);
  });
});
