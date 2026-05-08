/**
 * GNT Passage Parsing — types, verb extraction, and grading logic.
 *
 * Draws from /data/morphgnt/{CODE}.json via fetchBook() and fetchBooks()
 * from src/data/morphgnt.ts.
 *
 * Parse code positions (8 chars):
 *   [0] person  — 1/2/3/-
 *   [1] tense   — P/I/F/A/X/Y
 *   [2] voice   — A/M/P
 *   [3] mood    — I/D/S/O/N/P  (N=Infinitive, P=Participle)
 *   [4] case    — N/G/D/A/V
 *   [5] number  — S/P
 *   [6] gender  — M/F/N
 */

import type { MorphBook, MorphWord } from '../data/morphgnt';
import { splitWordPunct } from '../data/morphgnt';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type GNTTense = 'present' | 'imperfect' | 'future' | 'aorist' | 'perfect' | 'pluperfect';
export type GNTVoice = 'active' | 'middle' | 'passive';
export type GNTMood =
  | 'indicative'
  | 'imperative'
  | 'subjunctive'
  | 'optative'
  | 'infinitive'
  | 'participle';
export type GNTPerson = '1st' | '2nd' | '3rd';
export type GNTNumber = 'singular' | 'plural';
export type GNTCase = 'nominative' | 'genitive' | 'dative' | 'accusative' | 'vocative';
export type GNTGender = 'masculine' | 'feminine' | 'neuter';

export const GNT_TENSES: GNTTense[] = [
  'present',
  'imperfect',
  'future',
  'aorist',
  'perfect',
  'pluperfect',
];
export const GNT_VOICES: GNTVoice[] = ['active', 'middle', 'passive'];
export const GNT_MOODS: GNTMood[] = [
  'indicative',
  'imperative',
  'subjunctive',
  'optative',
  'infinitive',
  'participle',
];
export const GNT_PERSONS: GNTPerson[] = ['1st', '2nd', '3rd'];
export const GNT_NUMBERS: GNTNumber[] = ['singular', 'plural'];
export const GNT_CASES: GNTCase[] = ['nominative', 'genitive', 'dative', 'accusative', 'vocative'];
export const GNT_GENDERS: GNTGender[] = ['masculine', 'feminine', 'neuter'];

export const GNT_TENSE_LABELS: Record<GNTTense, string> = {
  present: 'Present',
  imperfect: 'Imperfect',
  future: 'Future',
  aorist: 'Aorist',
  perfect: 'Perfect',
  pluperfect: 'Pluperfect',
};
export const GNT_VOICE_LABELS: Record<GNTVoice, string> = {
  active: 'Active',
  middle: 'Middle',
  passive: 'Passive',
};
export const GNT_MOOD_LABELS: Record<GNTMood, string> = {
  indicative: 'Indicative',
  imperative: 'Imperative',
  subjunctive: 'Subjunctive',
  optative: 'Optative',
  infinitive: 'Infinitive',
  participle: 'Participle',
};
export const GNT_PERSON_LABELS: Record<GNTPerson, string> = {
  '1st': '1st',
  '2nd': '2nd',
  '3rd': '3rd',
};
export const GNT_NUMBER_LABELS: Record<GNTNumber, string> = {
  singular: 'Singular',
  plural: 'Plural',
};
export const GNT_CASE_LABELS: Record<GNTCase, string> = {
  nominative: 'Nominative',
  genitive: 'Genitive',
  dative: 'Dative',
  accusative: 'Accusative',
  vocative: 'Vocative',
};
export const GNT_GENDER_LABELS: Record<GNTGender, string> = {
  masculine: 'Masculine',
  feminine: 'Feminine',
  neuter: 'Neuter',
};

// Finite moods (have person + number)
export const FINITE_MOODS: GNTMood[] = ['indicative', 'imperative', 'subjunctive', 'optative'];

// ---------------------------------------------------------------------------
// Parse item — discriminated union by verb type
// ---------------------------------------------------------------------------

interface BaseItem {
  form: string; // word as shown (punctuation stripped)
  lemma: string;
  verseRef: string; // e.g. "John 3:16"
  verseWords: MorphWord[];
  wordIndex: number; // index of target verb within verseWords
  tense: GNTTense;
  voice: GNTVoice;
  mood: GNTMood;
}

export interface GNTFiniteItem extends BaseItem {
  type: 'finite';
  person: GNTPerson;
  number: GNTNumber;
}

export interface GNTInfinitiveItem extends BaseItem {
  type: 'infinitive';
}

export interface GNTParticipleItem extends BaseItem {
  type: 'participle';
  parseCase: GNTCase;
  number: GNTNumber;
  gender: GNTGender;
}

export type GNTParseItem = GNTFiniteItem | GNTInfinitiveItem | GNTParticipleItem;

// ---------------------------------------------------------------------------
// Answer — covers all possible properties
// ---------------------------------------------------------------------------

export interface GNTParseAnswer {
  tense: GNTTense | '';
  voice: GNTVoice | '';
  mood: GNTMood | '';
  // finite-specific
  person: GNTPerson | '';
  number: GNTNumber | '';
  // participle-specific
  parseCase: GNTCase | '';
  gender: GNTGender | '';
}

export function emptyGNTAnswer(): GNTParseAnswer {
  return { tense: '', voice: '', mood: '', person: '', number: '', parseCase: '', gender: '' };
}

// ---------------------------------------------------------------------------
// Grading result
// ---------------------------------------------------------------------------

export interface GNTParseResult {
  tense: boolean;
  voice: boolean;
  mood: boolean;
  person: boolean | null; // null = not applicable for this verb type
  number: boolean | null;
  parseCase: boolean | null;
  gender: boolean | null;
  allCorrect: boolean;
}

export function gradeGNTAnswer(item: GNTParseItem, answer: GNTParseAnswer): GNTParseResult {
  const tense = answer.tense === item.tense;
  const voice = answer.voice === item.voice;
  const mood = answer.mood === item.mood;

  if (item.type === 'finite') {
    const person = answer.person === item.person;
    const number = answer.number === item.number;
    return {
      tense,
      voice,
      mood,
      person,
      number,
      parseCase: null,
      gender: null,
      allCorrect: tense && voice && mood && person && number,
    };
  }

  if (item.type === 'infinitive') {
    return {
      tense,
      voice,
      mood,
      person: null,
      number: null,
      parseCase: null,
      gender: null,
      allCorrect: tense && voice && mood,
    };
  }

  // participle
  const parseCase = answer.parseCase === item.parseCase;
  const number = answer.number === item.number;
  const gender = answer.gender === item.gender;
  return {
    tense,
    voice,
    mood,
    person: null,
    number,
    parseCase,
    gender,
    allCorrect: tense && voice && mood && parseCase && number && gender,
  };
}

// ---------------------------------------------------------------------------
// Review helpers
// ---------------------------------------------------------------------------

/** Returns the subset of items whose corresponding result was not fully correct. */
export function filterMissedItems<T>(items: T[], results: GNTParseResult[]): T[] {
  return items.filter((_, i) => i < results.length && !results[i].allCorrect);
}

// ---------------------------------------------------------------------------
// Parse code → typed values
// ---------------------------------------------------------------------------

const TENSE_MAP: Record<string, GNTTense> = {
  P: 'present',
  I: 'imperfect',
  F: 'future',
  A: 'aorist',
  X: 'perfect',
  Y: 'pluperfect',
};
const VOICE_MAP: Record<string, GNTVoice> = {
  A: 'active',
  M: 'middle',
  P: 'passive',
};
const MOOD_MAP: Record<string, GNTMood> = {
  I: 'indicative',
  D: 'imperative',
  S: 'subjunctive',
  O: 'optative',
  N: 'infinitive',
  P: 'participle',
};
const PERSON_MAP: Record<string, GNTPerson> = {
  '1': '1st',
  '2': '2nd',
  '3': '3rd',
};
const NUMBER_MAP: Record<string, GNTNumber> = {
  S: 'singular',
  P: 'plural',
};
const CASE_MAP: Record<string, GNTCase> = {
  N: 'nominative',
  G: 'genitive',
  D: 'dative',
  A: 'accusative',
  V: 'vocative',
};
const GENDER_MAP: Record<string, GNTGender> = {
  M: 'masculine',
  F: 'feminine',
  N: 'neuter',
};

// ---------------------------------------------------------------------------
// Verb extraction
// ---------------------------------------------------------------------------

/**
 * Extract all verb parse items from a chapter (or verse range) of MorphGNT data.
 * Returns them in canonical (text order) sequence.
 */
export function extractVerbs(
  bookData: MorphBook,
  chapter: string,
  bookName: string,
  verseStart = 1,
  verseEnd = Infinity,
): GNTParseItem[] {
  const verses = bookData[chapter];
  if (!verses) return [];

  const items: GNTParseItem[] = [];

  for (const [verseNum, words] of Object.entries(verses)) {
    const v = parseInt(verseNum, 10);
    if (v < verseStart || v > verseEnd) continue;
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.pos !== 'V-') continue;
      if (word.parsing.length < 7) continue;

      const [p1, p2, p3, p4, p5, p6, p7] = word.parsing;

      const tense = TENSE_MAP[p2];
      const voice = VOICE_MAP[p3];
      const mood = MOOD_MAP[p4];
      if (!tense || !voice || !mood) continue;

      const [form] = splitWordPunct(word.text);

      const base: BaseItem = {
        form: form || word.text,
        lemma: word.lemma,
        verseRef: `${bookName} ${chapter}:${verseNum}`,
        verseWords: words,
        wordIndex: i,
        tense,
        voice,
        mood,
      };

      if (p4 === 'N') {
        // Infinitive — no person, number, case, gender
        items.push({ ...base, type: 'infinitive' });
      } else if (p4 === 'P') {
        // Participle
        const parseCase = CASE_MAP[p5];
        const number = NUMBER_MAP[p6];
        const gender = GENDER_MAP[p7];
        if (!parseCase || !number || !gender) continue;
        items.push({ ...base, type: 'participle', parseCase, number, gender });
      } else {
        // Finite verb
        const person = PERSON_MAP[p1];
        const number = NUMBER_MAP[p6];
        if (!person || !number) continue;
        items.push({ ...base, type: 'finite', person, number });
      }
    }
  }

  return items;
}

/** Return only the first occurrence of each lemma, in text order. */
export function deduplicateByLemma(items: GNTParseItem[]): GNTParseItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.lemma)) return false;
    seen.add(item.lemma);
    return true;
  });
}

/** Shuffle and take the first `count` items. */
export function sampleVerbs(items: GNTParseItem[], count: number): GNTParseItem[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, count);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface GNTPassageSettings {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number; // Infinity means "last verse in chapter"
  sessionLength: 10 | 20 | 30 | 'all';
  skipRepeatedLemmas: boolean;
}

const GNT_SETTINGS_KEY = 'greek-tools-gnt-parse-settings-v1';

export const DEFAULT_GNT_SETTINGS: GNTPassageSettings = {
  book: 'JHN',
  chapter: 1,
  verseStart: 1,
  verseEnd: Infinity,
  sessionLength: 20,
  skipRepeatedLemmas: false,
};

export function loadGNTSettings(): GNTPassageSettings {
  try {
    const raw = localStorage.getItem(GNT_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_GNT_SETTINGS };
    const p = JSON.parse(raw) as Partial<GNTPassageSettings>;
    return {
      book: typeof p.book === 'string' ? p.book : 'JHN',
      chapter: typeof p.chapter === 'number' ? p.chapter : 1,
      verseStart: typeof p.verseStart === 'number' && isFinite(p.verseStart) ? p.verseStart : 1,
      verseEnd: typeof p.verseEnd === 'number' && isFinite(p.verseEnd) ? p.verseEnd : Infinity,
      sessionLength: ([10, 20, 30, 'all'] as const).includes(
        p.sessionLength as 10 | 20 | 30 | 'all',
      )
        ? (p.sessionLength as GNTPassageSettings['sessionLength'])
        : 20,
      skipRepeatedLemmas: typeof p.skipRepeatedLemmas === 'boolean' ? p.skipRepeatedLemmas : false,
    };
  } catch {
    return { ...DEFAULT_GNT_SETTINGS };
  }
}

/** Format a human-readable passage reference for a verse range. */
export function formatRangeRef(
  bookName: string,
  chapter: number,
  verseStart: number,
  verseEnd: number,
  totalVerses: number,
): string {
  const effectiveEnd = !isFinite(verseEnd) || verseEnd >= totalVerses ? totalVerses : verseEnd;
  if (verseStart === 1 && effectiveEnd >= totalVerses) return `${bookName} ${chapter}`;
  if (verseStart === effectiveEnd) return `${bookName} ${chapter}:${verseStart}`;
  return `${bookName} ${chapter}:${verseStart}–${effectiveEnd}`;
}

export function saveGNTSettings(s: GNTPassageSettings): void {
  localStorage.setItem(GNT_SETTINGS_KEY, JSON.stringify(s));
}
