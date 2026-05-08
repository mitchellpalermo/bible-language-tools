/**
 * Tests for src/lib/gnt-parse.ts
 *
 * Covers: extractVerbs, sampleVerbs, gradeGNTAnswer.
 * Uses synthetic MorphBook fixtures — no network calls.
 */

import { describe, expect, it } from 'vitest';
import type { MorphBook } from '../data/morphgnt';
import {
  deduplicateByLemma,
  emptyGNTAnswer,
  extractVerbs,
  filterMissedItems,
  formatRangeRef,
  type GNTParseAnswer,
  type GNTParseItem,
  type GNTParseResult,
  gradeGNTAnswer,
  loadGNTSettings,
  sampleVerbs,
} from './gnt-parse';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Build a minimal MorphBook with a single chapter/verse of provided words. */
function makeBook(
  words: Array<{ text: string; lemma: string; pos: string; parsing: string }>,
): MorphBook {
  return { '1': { '1': words.map((w) => ({ ...w })) } };
}

type WordSpec = { text: string; lemma: string; pos: string; parsing: string };

/** Build a multi-verse MorphBook (chapter 1, verses 1–N, one word each). */
function makeMultiVerseBook(entries: Array<{ verse: number; word: WordSpec }>): MorphBook {
  const chapter: Record<string, WordSpec[]> = {};
  for (const { verse, word } of entries) {
    chapter[String(verse)] = [{ ...word }];
  }
  return { '1': chapter };
}

const FINITE_VERB = { text: 'λύει', lemma: 'λύω', pos: 'V-', parsing: '3PAI-S--' };
// 3=3rd, P=Present, A=Active, I=Indicative, -=no case, S=Singular, -=no gender
const INFINITIVE = { text: 'λύειν', lemma: 'λύω', pos: 'V-', parsing: '-PAN----' };
// -=no person, P=Present, A=Active, N=Infinitive
const PARTICIPLE = { text: 'βοώντος', lemma: 'βοάω', pos: 'V-', parsing: '-PAPGSMX' };
// -=no person, P=Present, A=Active, P=Participle, G=Genitive, S=Singular, M=Masculine
const NOUN = { text: 'ἀρχῇ', lemma: 'ἀρχή', pos: 'N-', parsing: '---DSF--' };

// ---------------------------------------------------------------------------
// extractVerbs
// ---------------------------------------------------------------------------

describe('extractVerbs', () => {
  it('ignores non-verb parts of speech', () => {
    const book = makeBook([NOUN]);
    expect(extractVerbs(book, '1', 'John')).toHaveLength(0);
  });

  it('extracts a finite verb', () => {
    const book = makeBook([FINITE_VERB]);
    const items = extractVerbs(book, '1', 'John');
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.type).toBe('finite');
    expect(item.tense).toBe('present');
    expect(item.voice).toBe('active');
    expect(item.mood).toBe('indicative');
    if (item.type === 'finite') {
      expect(item.person).toBe('3rd');
      expect(item.number).toBe('singular');
    }
    expect(item.form).toBe('λύει');
    expect(item.lemma).toBe('λύω');
    expect(item.verseRef).toBe('John 1:1');
  });

  it('extracts an infinitive', () => {
    const book = makeBook([INFINITIVE]);
    const items = extractVerbs(book, '1', 'John');
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.type).toBe('infinitive');
    expect(item.tense).toBe('present');
    expect(item.voice).toBe('active');
    expect(item.mood).toBe('infinitive');
  });

  it('extracts a participle', () => {
    const book = makeBook([PARTICIPLE]);
    const items = extractVerbs(book, '1', 'John');
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.type).toBe('participle');
    expect(item.tense).toBe('present');
    expect(item.voice).toBe('active');
    expect(item.mood).toBe('participle');
    if (item.type === 'participle') {
      expect(item.parseCase).toBe('genitive');
      expect(item.number).toBe('singular');
      expect(item.gender).toBe('masculine');
    }
  });

  it('extracts mixed verbs from the same verse', () => {
    const book = makeBook([NOUN, FINITE_VERB, INFINITIVE, PARTICIPLE]);
    const items = extractVerbs(book, '1', 'John');
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.type).sort()).toEqual(['finite', 'infinitive', 'participle'].sort());
  });

  it('returns empty array for missing chapter', () => {
    const book = makeBook([FINITE_VERB]);
    expect(extractVerbs(book, '99', 'John')).toHaveLength(0);
  });

  it('strips trailing punctuation from form', () => {
    const book = makeBook([{ ...FINITE_VERB, text: 'λύει·' }]);
    const items = extractVerbs(book, '1', 'John');
    expect(items[0].form).toBe('λύει');
  });

  it('records correct wordIndex for highlighting', () => {
    const book = makeBook([NOUN, FINITE_VERB]);
    const items = extractVerbs(book, '1', 'John');
    expect(items[0].wordIndex).toBe(1); // FINITE_VERB is at index 1
  });

  it('skips verbs with unrecognised parse codes', () => {
    const bad = { text: 'foo', lemma: 'foo', pos: 'V-', parsing: '---' }; // too short
    const book = makeBook([bad]);
    expect(extractVerbs(book, '1', 'John')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// sampleVerbs
// ---------------------------------------------------------------------------

describe('sampleVerbs', () => {
  const book = makeBook([FINITE_VERB, INFINITIVE, PARTICIPLE]);
  const all = extractVerbs(book, '1', 'John');

  it('returns at most count items', () => {
    expect(sampleVerbs(all, 2)).toHaveLength(2);
  });

  it('returns all items when count >= length', () => {
    expect(sampleVerbs(all, 10)).toHaveLength(3);
  });

  it('does not mutate the original array', () => {
    const copy = [...all];
    sampleVerbs(all, 2);
    expect(all).toHaveLength(copy.length);
  });
});

// ---------------------------------------------------------------------------
// gradeGNTAnswer — finite verb
// ---------------------------------------------------------------------------

describe('gradeGNTAnswer — finite verb', () => {
  const book = makeBook([FINITE_VERB]);
  const item = extractVerbs(book, '1', 'John')[0] as GNTParseItem;

  it('all correct', () => {
    const answer: GNTParseAnswer = {
      tense: 'present',
      voice: 'active',
      mood: 'indicative',
      person: '3rd',
      number: 'singular',
      parseCase: '',
      gender: '',
    };
    const result = gradeGNTAnswer(item, answer);
    expect(result.allCorrect).toBe(true);
    expect(result.tense).toBe(true);
    expect(result.voice).toBe(true);
    expect(result.mood).toBe(true);
    expect(result.person).toBe(true);
    expect(result.number).toBe(true);
    expect(result.parseCase).toBeNull();
    expect(result.gender).toBeNull();
  });

  it('wrong tense', () => {
    const answer: GNTParseAnswer = {
      tense: 'aorist',
      voice: 'active',
      mood: 'indicative',
      person: '3rd',
      number: 'singular',
      parseCase: '',
      gender: '',
    };
    const result = gradeGNTAnswer(item, answer);
    expect(result.allCorrect).toBe(false);
    expect(result.tense).toBe(false);
  });

  it('empty answer — all false', () => {
    const result = gradeGNTAnswer(item, emptyGNTAnswer());
    expect(result.allCorrect).toBe(false);
    expect(result.tense).toBe(false);
    expect(result.voice).toBe(false);
    expect(result.mood).toBe(false);
    expect(result.person).toBe(false);
    expect(result.number).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// gradeGNTAnswer — infinitive
// ---------------------------------------------------------------------------

describe('gradeGNTAnswer — infinitive', () => {
  const book = makeBook([INFINITIVE]);
  const item = extractVerbs(book, '1', 'John')[0];

  it('all correct — no person/number/case/gender', () => {
    const answer: GNTParseAnswer = {
      tense: 'present',
      voice: 'active',
      mood: 'infinitive',
      person: '',
      number: '',
      parseCase: '',
      gender: '',
    };
    const result = gradeGNTAnswer(item, answer);
    expect(result.allCorrect).toBe(true);
    expect(result.person).toBeNull();
    expect(result.number).toBeNull();
    expect(result.parseCase).toBeNull();
    expect(result.gender).toBeNull();
  });

  it('wrong voice', () => {
    const answer: GNTParseAnswer = {
      tense: 'present',
      voice: 'passive',
      mood: 'infinitive',
      person: '',
      number: '',
      parseCase: '',
      gender: '',
    };
    expect(gradeGNTAnswer(item, answer).allCorrect).toBe(false);
    expect(gradeGNTAnswer(item, answer).voice).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// gradeGNTAnswer — participle
// ---------------------------------------------------------------------------

describe('gradeGNTAnswer — participle', () => {
  const book = makeBook([PARTICIPLE]);
  const item = extractVerbs(book, '1', 'John')[0];

  it('all correct', () => {
    const answer: GNTParseAnswer = {
      tense: 'present',
      voice: 'active',
      mood: 'participle',
      person: '',
      number: 'singular',
      parseCase: 'genitive',
      gender: 'masculine',
    };
    const result = gradeGNTAnswer(item, answer);
    expect(result.allCorrect).toBe(true);
    expect(result.person).toBeNull();
    expect(result.parseCase).toBe(true);
    expect(result.number).toBe(true);
    expect(result.gender).toBe(true);
  });

  it('wrong case', () => {
    const answer: GNTParseAnswer = {
      tense: 'present',
      voice: 'active',
      mood: 'participle',
      person: '',
      number: 'singular',
      parseCase: 'nominative',
      gender: 'masculine',
    };
    const result = gradeGNTAnswer(item, answer);
    expect(result.allCorrect).toBe(false);
    expect(result.parseCase).toBe(false);
  });

  it('wrong gender', () => {
    const answer: GNTParseAnswer = {
      tense: 'present',
      voice: 'active',
      mood: 'participle',
      person: '',
      number: 'singular',
      parseCase: 'genitive',
      gender: 'feminine',
    };
    expect(gradeGNTAnswer(item, answer).gender).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractVerbs — verse range filtering
// ---------------------------------------------------------------------------

describe('extractVerbs — verse range filtering', () => {
  const book = makeMultiVerseBook([
    { verse: 1, word: FINITE_VERB },
    { verse: 2, word: FINITE_VERB },
    { verse: 3, word: FINITE_VERB },
    { verse: 4, word: FINITE_VERB },
    { verse: 5, word: FINITE_VERB },
  ]);

  it('returns all verbs when no range given (full chapter)', () => {
    expect(extractVerbs(book, '1', 'John')).toHaveLength(5);
  });

  it('filters to a single verse', () => {
    const items = extractVerbs(book, '1', 'John', 3, 3);
    expect(items).toHaveLength(1);
    expect(items[0].verseRef).toBe('John 1:3');
  });

  it('filters to a range', () => {
    const items = extractVerbs(book, '1', 'John', 2, 4);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.verseRef)).toEqual(['John 1:2', 'John 1:3', 'John 1:4']);
  });

  it('verseStart=1, verseEnd=Infinity behaves like full chapter', () => {
    expect(extractVerbs(book, '1', 'John', 1, Infinity)).toHaveLength(5);
  });

  it('returns empty array when range has no matching verses', () => {
    expect(extractVerbs(book, '1', 'John', 10, 20)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// formatRangeRef
// ---------------------------------------------------------------------------

describe('formatRangeRef', () => {
  it('returns book+chapter only for full chapter (verseStart=1, verseEnd=totalVerses)', () => {
    expect(formatRangeRef('John', 1, 1, 50, 50)).toBe('John 1');
  });

  it('returns book+chapter only for full chapter (verseEnd=Infinity)', () => {
    expect(formatRangeRef('John', 1, 1, Infinity, 50)).toBe('John 1');
  });

  it('returns single verse reference when start equals end', () => {
    expect(formatRangeRef('John', 1, 3, 3, 50)).toBe('John 1:3');
  });

  it('returns range reference with en-dash', () => {
    expect(formatRangeRef('John', 1, 1, 18, 50)).toBe('John 1:1–18');
  });

  it('treats verseEnd > totalVerses same as full chapter', () => {
    expect(formatRangeRef('Romans', 8, 1, 999, 39)).toBe('Romans 8');
  });

  it('handles chapter other than 1', () => {
    expect(formatRangeRef('Romans', 8, 1, 17, 39)).toBe('Romans 8:1–17');
  });
});

// ---------------------------------------------------------------------------
// loadGNTSettings — backward compatibility
// ---------------------------------------------------------------------------

describe('loadGNTSettings — backward compatibility', () => {
  it('defaults verseStart and verseEnd when missing from stored settings', () => {
    localStorage.setItem(
      'greek-tools-gnt-parse-settings-v1',
      JSON.stringify({ book: 'ROM', chapter: 3, sessionLength: 10 }),
    );
    const s = loadGNTSettings();
    expect(s.verseStart).toBe(1);
    expect(s.verseEnd).toBe(Infinity);
    localStorage.removeItem('greek-tools-gnt-parse-settings-v1');
  });

  it('defaults verseEnd to Infinity when stored as null (JSON.stringify(Infinity))', () => {
    localStorage.setItem(
      'greek-tools-gnt-parse-settings-v1',
      JSON.stringify({ book: 'JHN', chapter: 1, verseStart: 1, verseEnd: null, sessionLength: 20 }),
    );
    const s = loadGNTSettings();
    expect(s.verseEnd).toBe(Infinity);
    localStorage.removeItem('greek-tools-gnt-parse-settings-v1');
  });

  it('preserves a finite verseEnd that was saved', () => {
    localStorage.setItem(
      'greek-tools-gnt-parse-settings-v1',
      JSON.stringify({ book: 'JHN', chapter: 1, verseStart: 3, verseEnd: 18, sessionLength: 20 }),
    );
    const s = loadGNTSettings();
    expect(s.verseStart).toBe(3);
    expect(s.verseEnd).toBe(18);
    localStorage.removeItem('greek-tools-gnt-parse-settings-v1');
  });

  it('defaults skipRepeatedLemmas to false when missing from stored settings', () => {
    localStorage.setItem(
      'greek-tools-gnt-parse-settings-v1',
      JSON.stringify({ book: 'JHN', chapter: 1, verseStart: 1, verseEnd: null, sessionLength: 20 }),
    );
    const s = loadGNTSettings();
    expect(s.skipRepeatedLemmas).toBe(false);
    localStorage.removeItem('greek-tools-gnt-parse-settings-v1');
  });

  it('preserves skipRepeatedLemmas: true when saved', () => {
    localStorage.setItem(
      'greek-tools-gnt-parse-settings-v1',
      JSON.stringify({
        book: 'JHN',
        chapter: 1,
        verseStart: 1,
        verseEnd: null,
        sessionLength: 20,
        skipRepeatedLemmas: true,
      }),
    );
    const s = loadGNTSettings();
    expect(s.skipRepeatedLemmas).toBe(true);
    localStorage.removeItem('greek-tools-gnt-parse-settings-v1');
  });
});

// ---------------------------------------------------------------------------
// deduplicateByLemma
// ---------------------------------------------------------------------------

describe('deduplicateByLemma', () => {
  const FINITE_VERB_2 = { text: 'λύεις', lemma: 'λύω', pos: 'V-', parsing: '2PAI-S--' };
  // same lemma as FINITE_VERB, different form

  it('returns all items when all lemmas are unique', () => {
    const book = makeBook([FINITE_VERB, PARTICIPLE]); // λύω, βοάω
    const items = extractVerbs(book, '1', 'John');
    expect(deduplicateByLemma(items)).toHaveLength(2);
  });

  it('keeps only the first occurrence of a repeated lemma', () => {
    const book = makeBook([FINITE_VERB, FINITE_VERB_2]); // λύω twice
    const items = extractVerbs(book, '1', 'John');
    const deduped = deduplicateByLemma(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].form).toBe('λύει'); // first occurrence kept
  });

  it('preserves text order', () => {
    const book = makeBook([PARTICIPLE, FINITE_VERB, FINITE_VERB_2]); // βοάω, λύω, λύω
    const items = extractVerbs(book, '1', 'John');
    const deduped = deduplicateByLemma(items);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].lemma).toBe('βοάω');
    expect(deduped[1].lemma).toBe('λύω');
  });

  it('returns an empty array when given an empty array', () => {
    expect(deduplicateByLemma([])).toHaveLength(0);
  });

  it('does not mutate the input array', () => {
    const book = makeBook([FINITE_VERB, FINITE_VERB_2]);
    const items = extractVerbs(book, '1', 'John');
    const copy = [...items];
    deduplicateByLemma(items);
    expect(items).toHaveLength(copy.length);
  });

  it('deduplicates across verse boundaries in a multi-verse book', () => {
    const FINITE_VERB_2 = { text: 'λύεις', lemma: 'λύω', pos: 'V-', parsing: '2PAI-S--' };
    const book = makeMultiVerseBook([
      { verse: 1, word: FINITE_VERB }, // λύω
      { verse: 2, word: PARTICIPLE }, // βοάω
      { verse: 3, word: FINITE_VERB_2 }, // λύω again
    ]);
    const items = extractVerbs(book, '1', 'John');
    expect(items).toHaveLength(3);
    const deduped = deduplicateByLemma(items);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((i) => i.lemma)).toEqual(['λύω', 'βοάω']);
  });
});

// ---------------------------------------------------------------------------
// filterMissedItems
// ---------------------------------------------------------------------------

function makeResult(allCorrect: boolean): GNTParseResult {
  return {
    tense: allCorrect,
    voice: allCorrect,
    mood: allCorrect,
    person: allCorrect,
    number: allCorrect,
    parseCase: null,
    gender: null,
    allCorrect,
  };
}

describe('filterMissedItems', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('returns empty array when all results are correct', () => {
    const results = items.map(() => makeResult(true));
    expect(filterMissedItems(items, results)).toEqual([]);
  });

  it('returns all items when all results are wrong', () => {
    const results = items.map(() => makeResult(false));
    expect(filterMissedItems(items, results)).toEqual(items);
  });

  it('returns only the items whose result has allCorrect=false', () => {
    const results = [makeResult(true), makeResult(false), makeResult(true), makeResult(false)];
    expect(filterMissedItems(items, results)).toEqual(['b', 'd']);
  });

  it('preserves original order of missed items', () => {
    const results = [makeResult(false), makeResult(true), makeResult(false)];
    expect(filterMissedItems(['x', 'y', 'z'], results)).toEqual(['x', 'z']);
  });

  it('returns empty array when results array is empty', () => {
    expect(filterMissedItems(items, [])).toEqual([]);
  });

  it('handles results shorter than items (partial session)', () => {
    const results = [makeResult(false), makeResult(true)];
    expect(filterMissedItems(items, results)).toEqual(['a']);
  });
});
