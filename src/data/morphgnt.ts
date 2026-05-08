// ─── Types ────────────────────────────────────────────────────────────────────

export interface MorphWord {
  text: string; // word as it appears in text (may include trailing punctuation)
  lemma: string; // lexical form (matches MorphGNT lemma)
  pos: string; // part-of-speech code (e.g. "N-", "V-", "P-")
  parsing: string; // 8-char parse code (person/tense/voice/mood/case/number/gender/degree)
}

export type MorphVerse = MorphWord[];
// chapter string key → verse string key → words
export type MorphBook = Record<string, Record<string, MorphVerse>>;

export interface BookMeta {
  code: string;
  name: string;
  chapters: number;
}

// ─── Parse code → human-readable string ──────────────────────────────────────

const TENSE: Record<string, string> = {
  P: 'Present',
  I: 'Imperfect',
  F: 'Future',
  A: 'Aorist',
  X: 'Perfect',
  Y: 'Pluperfect',
};
const VOICE: Record<string, string> = { A: 'Active', M: 'Middle', P: 'Passive' };
const MOOD: Record<string, string> = {
  I: 'Indicative',
  D: 'Imperative',
  S: 'Subjunctive',
  O: 'Optative',
  N: 'Infinitive',
  P: 'Participle',
};
const CASE: Record<string, string> = {
  N: 'Nominative',
  G: 'Genitive',
  D: 'Dative',
  A: 'Accusative',
  V: 'Vocative',
};
const NUMBER: Record<string, string> = { S: 'Singular', P: 'Plural' };
const GENDER: Record<string, string> = { M: 'Masculine', F: 'Feminine', N: 'Neuter' };
const PERSON: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' };

const POS_LABEL: Record<string, string> = {
  'N-': 'Noun',
  'A-': 'Adjective',
  RA: 'Article',
  RP: 'Personal Pronoun',
  RR: 'Relative Pronoun',
  RD: 'Demonstrative Pronoun',
  RI: 'Interrogative Pronoun',
  RX: 'Reflexive Pronoun',
  'V-': 'Verb',
  'P-': 'Preposition',
  'D-': 'Adverb',
  'C-': 'Conjunction',
  CC: 'Conjunction',
  CS: 'Conjunction',
  'I-': 'Interjection',
  'X-': 'Particle',
};

const get = (map: Record<string, string>, key: string): string => map[key] ?? '';

export function formatParse(pos: string, parsing: string): string {
  if (!parsing || parsing.length < 8) return POS_LABEL[pos] ?? pos;

  const [p1, p2, p3, p4, p5, p6, p7] = parsing;
  const label = POS_LABEL[pos] ?? pos;

  if (pos === 'V-') {
    if (p4 === 'N') {
      // Infinitive: tense + voice
      return `Verb — ${get(TENSE, p2)} ${get(VOICE, p3)} Infinitive`.trim();
    }
    if (p4 === 'P') {
      // Participle: tense + voice + case + number + gender
      const parts = [
        get(TENSE, p2),
        get(VOICE, p3),
        'Participle',
        get(CASE, p5),
        get(NUMBER, p6),
        get(GENDER, p7),
      ].filter(Boolean);
      return `Verb — ${parts.join(' ')}`;
    }
    // Finite verb: person + tense + voice + mood + number
    const parts = [
      get(PERSON, p1),
      get(TENSE, p2),
      get(VOICE, p3),
      get(MOOD, p4),
      get(NUMBER, p6),
    ].filter(Boolean);
    return `Verb — ${parts.join(' ')}`;
  }

  if (['N-', 'A-', 'RA', 'RP', 'RR', 'RD', 'RI', 'RX'].includes(pos)) {
    const parts = [get(CASE, p5), get(NUMBER, p6), get(GENDER, p7)].filter(Boolean);
    return parts.length ? `${label} — ${parts.join(' ')}` : label;
  }

  return label;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/** Split a MorphGNT text field into the word and trailing punctuation. */
export function splitWordPunct(text: string): [word: string, punct: string] {
  const match = /^([\s\S]*?)([,.:;·—?!\u00B7]*)$/.exec(text);
  if (!match) return [text, ''];
  return [match[1], match[2]];
}

// ─── Client-side book cache + fetch ──────────────────────────────────────────

const bookCache = new Map<string, MorphBook>();

export async function fetchBook(code: string): Promise<MorphBook> {
  if (bookCache.has(code)) return bookCache.get(code)!;
  const res = await fetch(`/data/morphgnt/${code}.json`);
  if (!res.ok) throw new Error(`Failed to load ${code}: HTTP ${res.status}`);
  const data = (await res.json()) as MorphBook;
  bookCache.set(code, data);
  return data;
}

export async function fetchBooks(): Promise<BookMeta[]> {
  const res = await fetch('/data/morphgnt/books.json');
  if (!res.ok) throw new Error(`Failed to load books index: HTTP ${res.status}`);
  return res.json() as Promise<BookMeta[]>;
}

// ─── localStorage key for reading history ────────────────────────────────────

export const READER_HISTORY_KEY = 'greek-tools-reader-last';

export function saveLastPassage(ref: string): void {
  try {
    localStorage.setItem(READER_HISTORY_KEY, ref);
  } catch {
    /* ignore */
  }
}

export function loadLastPassage(): string | null {
  try {
    return localStorage.getItem(READER_HISTORY_KEY);
  } catch {
    return null;
  }
}
