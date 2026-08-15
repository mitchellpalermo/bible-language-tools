import { describe, expect, it } from 'vitest';

import {
  checkEntries,
  DISPLAY_NAMES,
  failureLines,
  longVerses,
  parseEntries,
  verseText,
} from './daily-verses.mjs';

/**
 * The checker's own tests, over a synthetic corpus.
 *
 * These run everywhere, including CI, because nothing here touches
 * `public/data/morphhb/`. Whether the *real* list resolves against the *real*
 * corpus is `src/data/dailyVerses.corpus.test.ts`, which skips when the 24 MB
 * of gitignored data is not built.
 *
 * A validator that cannot fail is worth nothing, so every check below is
 * exercised by an entry that violates it.
 */

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const word = (text) => ({ text });

/** Two books: Jonah with a 16-verse chapter 1, and Amos with a 24-verse ch. 5. */
const CORPUS = {
  JON: {
    1: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, [word('א')]])),
    2: { 1: Array.from({ length: 15 }, () => word('ב')) },
  },
  AMO: {
    5: { 24: [word('ג'), word('ד')] },
  },
};

const lookup = (code) => CORPUS[code] ?? null;
const check = (entries) => checkEntries(entries, { lookup, displayNames: DISPLAY_NAMES });
const problemsFor = (entry) => check([entry])[0].problems;

const JONAH = { book: 'JON', chapter: 2, verse: 1, displayRef: 'Jonah 2:1' };

// ─── DISPLAY_NAMES ────────────────────────────────────────────────────────────

describe('DISPLAY_NAMES', () => {
  it('names a single psalm in the singular', () => {
    // A reference names one psalm, not the collection.
    expect(DISPLAY_NAMES.get('PSA')).toBe('Psalm');
  });

  it('takes every other name from the book index', () => {
    expect(DISPLAY_NAMES.get('GEN')).toBe('Genesis');
    expect(DISPLAY_NAMES.get('1SA')).toBe('1 Samuel');
    expect(DISPLAY_NAMES.get('SNG')).toBe('Song of Songs');
  });

  it('covers all 39 books', () => {
    expect(DISPLAY_NAMES.size).toBe(39);
  });
});

// ─── parseEntries ─────────────────────────────────────────────────────────────

describe('parseEntries', () => {
  const source = `
export const DAILY_VERSES: readonly DailyVerseRef[] = [
  { book: 'GEN', chapter: 1, verse: 1, displayRef: 'Genesis 1:1' },
  { book: 'JON', chapter: 2, verse: 1, displayRef: 'Jonah 2:1', english: 'Jonah 1:17' },
] as const;
`;

  it('reads every entry', () => {
    expect(parseEntries(source)).toEqual([
      { book: 'GEN', chapter: 1, verse: 1, displayRef: 'Genesis 1:1' },
      { book: 'JON', chapter: 2, verse: 1, displayRef: 'Jonah 2:1', english: 'Jonah 1:17' },
    ]);
  });

  it('omits english entirely when it is not given', () => {
    // Not `undefined` — absent, so a strict comparison against the imported
    // array in the corpus test agrees.
    expect('english' in parseEntries(source)[0]).toBe(false);
  });

  it('reads numbers as numbers', () => {
    const [first] = parseEntries(source);
    expect(first.chapter).toBe(1);
    expect(typeof first.verse).toBe('number');
  });

  it('throws rather than silently reading a subset', () => {
    // The guard that matters: reformat the literal and the regex stops matching,
    // which without this check would report success over the entries it still
    // happened to match.
    const drifted = source.replace(
      "{ book: 'GEN', chapter: 1, verse: 1, displayRef: 'Genesis 1:1' },",
      "{\n    book: 'GEN',\n    chapter: 1,\n    verse: 1,\n    displayRef: `Genesis 1:1`,\n  },",
    );
    expect(() => parseEntries(drifted)).toThrow(/parsed 1 of 2 entries/);
  });

  it('throws when the literal is not there at all', () => {
    expect(() => parseEntries('export const NOTHING = [];')).toThrow(/could not find/);
  });
});

// ─── checkEntries ─────────────────────────────────────────────────────────────

describe('checkEntries', () => {
  it('passes an entry that resolves', () => {
    expect(problemsFor(JONAH)).toEqual([]);
  });

  it('returns the verse’s words so a caller need not re-read the corpus', () => {
    expect(check([JONAH])[0].words).toHaveLength(15);
  });

  it('preserves entry order', () => {
    const results = check([JONAH, { ...JONAH, book: 'AMO', chapter: 5, verse: 24 }]);
    expect(results.map((r) => r.entry.book)).toEqual(['JON', 'AMO']);
  });

  describe('catches the English-versification trap', () => {
    it('flags a verse the Hebrew chapter does not reach', () => {
      // English Jonah 1:17 is Hebrew Jonah 2:1 — the reference this whole
      // module exists to catch, because it looks entirely plausible.
      const problems = problemsFor({
        book: 'JON',
        chapter: 1,
        verse: 17,
        displayRef: 'Jonah 1:17',
      });
      expect(problems).toContain('no verse 17 (JON 1 has 1–16)');
    });

    it('flags a chapter the book does not have', () => {
      const problems = problemsFor({
        book: 'JON',
        chapter: 5,
        verse: 1,
        displayRef: 'Jonah 5:1',
      });
      expect(problems).toContain('no chapter 5 (JON has 1–2)');
    });
  });

  describe('catches a mislabelled reference', () => {
    it('flags a displayRef that disagrees with the numbers it fetches', () => {
      const problems = problemsFor({ ...JONAH, displayRef: 'Jonah 2:2' });
      expect(problems).toContain("displayRef 'Jonah 2:2' should read 'Jonah 2:1'");
    });

    it('flags a displayRef naming the wrong book', () => {
      const problems = problemsFor({ ...JONAH, displayRef: 'Amos 2:1' });
      expect(problems).toContain("displayRef 'Amos 2:1' should read 'Jonah 2:1'");
    });

    it('accepts the singular Psalm spelling', () => {
      const withPsalms = checkEntries(
        [{ book: 'PSA', chapter: 23, verse: 1, displayRef: 'Psalm 23:1' }],
        { lookup: () => null, displayNames: DISPLAY_NAMES },
      );
      // The corpus is absent here, so the only complaint should be about that.
      expect(withPsalms[0].problems).toEqual(['no corpus file — run `pnpm build:data`']);
    });
  });

  describe('catches a bad english field', () => {
    it('flags english duplicating displayRef', () => {
      const problems = problemsFor({ ...JONAH, english: 'Jonah 2:1' });
      expect(problems).toContain(
        "english 'Jonah 2:1' duplicates displayRef — omit it when the two agree",
      );
    });

    it('accepts english that genuinely differs', () => {
      expect(problemsFor({ ...JONAH, english: 'Jonah 1:17' })).toEqual([]);
    });
  });

  it('flags a duplicate reference, on the second occurrence only', () => {
    const results = check([JONAH, JONAH]);
    expect(results[0].problems).toEqual([]);
    expect(results[1].problems).toContain('duplicate reference');
  });

  it('flags an unknown book code', () => {
    const problems = problemsFor({
      book: 'ZZZ',
      chapter: 1,
      verse: 1,
      displayRef: 'Nowhere 1:1',
    });
    expect(problems).toContain("unknown book code 'ZZZ'");
  });

  it('reports a missing corpus file rather than crashing', () => {
    const problems = problemsFor({ book: 'GEN', chapter: 1, verse: 1, displayRef: 'Genesis 1:1' });
    expect(problems).toContain('no corpus file — run `pnpm build:data`');
  });

  it('collects several problems on one entry', () => {
    const problems = problemsFor({ ...JONAH, displayRef: 'Jonah 9:9', english: 'Jonah 9:9' });
    expect(problems.length).toBeGreaterThan(1);
  });
});

// ─── Reporting ────────────────────────────────────────────────────────────────

describe('failureLines', () => {
  it('is empty when everything resolves', () => {
    expect(failureLines(check([JONAH]))).toEqual([]);
  });

  it('names the entry and indents each of its problems', () => {
    const lines = failureLines(check([{ ...JONAH, displayRef: 'Jonah 2:2' }]));
    expect(lines[0]).toContain('Jonah 2:2 (JON.2.1)');
    expect(lines[1]).toMatch(/^ {6}displayRef/);
  });
});

describe('longVerses', () => {
  it('flags a verse over the limit', () => {
    expect(longVerses(check([JONAH]), 10)).toEqual(['Jonah 2:1 (15 words)']);
  });

  it('says nothing about a verse at or under the limit', () => {
    expect(longVerses(check([JONAH]), 15)).toEqual([]);
  });

  it('ignores entries that failed, since their length is unknown', () => {
    const results = check([{ ...JONAH, chapter: 9 }]);
    expect(longVerses(results, 1)).toEqual([]);
  });
});

describe('verseText', () => {
  it('joins words with spaces', () => {
    expect(verseText([{ text: 'א' }, { text: 'ב' }])).toBe('א ב');
  });

  it('strips OSHB morpheme boundaries, which must never reach a reader', () => {
    expect(verseText([{ text: 'וַ/יְהִי' }])).toBe('וַיְהִי');
  });

  it('prefers the qere, which is what a reader reads', () => {
    expect(verseText([{ text: 'כתיב', qere: 'קרי' }])).toBe('קרי');
  });

  it('keeps trailing punctuation attached', () => {
    expect(verseText([{ text: 'א', after: '׃' }])).toBe('א׃');
  });
});
