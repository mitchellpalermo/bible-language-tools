// Grammar Reference data — the alphabet and the vowel chart (ROADMAP Phase 6,
// issue #79). Mirrors greek-tools' `src/data/grammar.ts`: the page renders,
// this file knows.
//
// Three things are load-bearing and none is obvious:
//
// **Names and transliteration come from the script pack, not from here.**
// `/write` already names every letter and every vowel point, following Garrett
// & DeRouchie. A second list would be a second spelling of "tsade" waiting to
// drift from the first, so this file only adds what a *reference* needs and a
// handwriting deck does not: how a letter sounds, which class it belongs to,
// and where a vowel sits in the chart. `grammar.test.ts` pins that every glyph
// in the pack has its facts — a letter added there fails here by name.
//
// **Shin and sin are two rows of a 22-letter alphabet.** They are one letter
// distinguished by a dot, and a bare ש occurs nowhere in the text, so the pack
// carries a card for each and the table has 23 rows. `ALPHABET_LETTER_COUNT`
// is the number a student is taught; do not derive it from `letters.length`.
//
// **The verb paradigms are not here.** They live in `verb-paradigms.ts`, which
// the paradigm quiz also reads; the reference renders that file directly so
// the table a student studies and the key they are marked against cannot
// disagree.

import { glyphsInGroup, renderableText, type WritableGlyph } from '@tools/shared/ink';
import { DAGESH, FINAL_FORM_MAP } from '../lib/hebrew-input';
import { hebrewScriptPack } from './script-pack';

// ─── Alphabet ─────────────────────────────────────────────────────────────────

/** The alphabet as it is counted: שׁ and שׂ are one letter. */
export const ALPHABET_LETTER_COUNT = 22;

export interface Letter {
  /** The letter as written — with its dot, for shin and sin. */
  char: string;
  name: string;
  /** Transliteration, as the script pack gives it. */
  translit: string;
  /** How it is pronounced, in plain English. For a begadkephat, the hard sound. */
  sound: string;
  /** The form it takes at the end of a word, for the five letters that have one. */
  final?: string;
  /** Present for the six letters that take a dagesh lene. */
  begadkephat?: Begadkephat;
  /** One of the four gutturals. */
  guttural: boolean;
}

export interface Begadkephat {
  /** The letter with its dagesh lene — the form `translit` and `sound` describe. */
  hard: string;
  /** Transliteration without the dot. */
  softTranslit: string;
  /**
   * The sound without the dot, for the three letters where it still differs.
   * Absent for ג, ד and ת, which are pronounced alike either way.
   */
  softSound?: string;
}

interface LetterFacts {
  sound: string;
  soft?: { translit: string; sound?: string };
  guttural?: true;
}

/**
 * What the reference adds to each letter, keyed by the pack's `char`.
 *
 * The pack's `phonetic` for a begadkephat letter is the stop (b, g, d, k, p, t)
 * — the sound a beginner learns first — so `sound` describes that one and
 * `soft` supplies the other. Only ב, כ and פ are still distinguished in the
 * pronunciation the course uses; ג, ד and ת are pronounced alike with or
 * without the dot, and leaving `soft.sound` off says so rather than inventing
 * three sounds nobody is asked to make.
 */
const LETTER_FACTS: Record<string, LetterFacts> = {
  א: { sound: 'silent — a glottal stop', guttural: true },
  ב: { sound: 'b as in boy', soft: { translit: 'v', sound: 'v as in vine' } },
  ג: { sound: 'g as in go', soft: { translit: 'gh' } },
  ד: { sound: 'd as in day', soft: { translit: 'dh' } },
  ה: { sound: 'h as in hay', guttural: true },
  ו: { sound: 'w as in way' },
  ז: { sound: 'z as in zeal' },
  ח: { sound: 'ch as in Bach', guttural: true },
  ט: { sound: 't as in toy' },
  י: { sound: 'y as in yes' },
  כ: { sound: 'k as in king', soft: { translit: 'kh', sound: 'ch as in Bach' } },
  ל: { sound: 'l as in look' },
  מ: { sound: 'm as in mother' },
  נ: { sound: 'n as in now' },
  ס: { sound: 's as in sin' },
  ע: { sound: 'silent — a stop deep in the throat', guttural: true },
  פ: { sound: 'p as in pay', soft: { translit: 'f', sound: 'f as in fish' } },
  צ: { sound: 'ts as in cats' },
  ק: { sound: 'k as in king' },
  ר: { sound: 'r as in run' },
  שׁ: { sound: 'sh as in ship' },
  שׂ: { sound: 's as in sin' },
  ת: { sound: 't as in toy', soft: { translit: 'th' } },
};

/** The pack's transliteration, which every letter and vowel point is expected to carry. */
function translitOf(glyph: WritableGlyph): string {
  if (!glyph.phonetic) throw new Error(`grammar: ${glyph.name} has no transliteration`);
  return glyph.phonetic;
}

function toLetter(glyph: WritableGlyph): Letter {
  const facts = LETTER_FACTS[glyph.char];
  if (!facts) throw new Error(`grammar: no letter facts for ${glyph.name} (${glyph.char})`);
  const final = FINAL_FORM_MAP[glyph.char];
  return {
    char: glyph.char,
    name: glyph.name,
    translit: translitOf(glyph),
    sound: facts.sound,
    ...(final ? { final } : {}),
    ...(facts.soft
      ? {
          begadkephat: {
            hard: glyph.char + DAGESH,
            softTranslit: facts.soft.translit,
            ...(facts.soft.sound ? { softSound: facts.soft.sound } : {}),
          },
        }
      : {}),
    guttural: facts.guttural === true,
  };
}

/** The alphabet in order — 23 rows, because shin and sin each get one. */
export const letters: Letter[] = glyphsInGroup(hebrewScriptPack, 'consonant').map(toLetter);

/**
 * Sets of letters that behave alike, each with the one consequence worth
 * remembering it for. These are the groups later chapters keep pointing back
 * to — a rule about "gutturals" is unreadable without the list.
 */
export interface LetterGroup {
  id: string;
  name: string;
  letters: string[];
  note: string;
}

export const letterGroups: LetterGroup[] = [
  {
    id: 'begadkephat',
    name: 'Begadkephat',
    letters: letters.flatMap((l) => (l.begadkephat ? [l.begadkephat.hard] : [])),
    note: 'Take a dagesh lene at the start of a word or after a closed syllable, marking the hard sound. After a vowel the dot is absent and the sound softens.',
  },
  {
    id: 'gutturals',
    name: 'Gutturals',
    letters: letters.filter((l) => l.guttural).map((l) => l.char),
    note: 'Cannot be doubled, so they refuse a dagesh forte; prefer a-class vowels; and take a hateph vowel where another letter would take a vocal sheva. ר is not a guttural but also refuses the dagesh.',
  },
  {
    id: 'finals',
    name: 'Final forms',
    letters: Object.values(FINAL_FORM_MAP),
    note: 'Five letters change shape at the end of a word. Four of the five drop below the line; ם closes into a square.',
  },
  {
    id: 'sibilants',
    name: 'Sibilants',
    letters: ['ז', 'ס', 'צ', 'שׂ', 'שׁ'],
    note: 'The s-sounds. In the Hithpael a sibilant first radical trades places with the ת of the prefix.',
  },
  {
    id: 'labials',
    name: 'Labials',
    letters: ['ב', 'מ', 'פ'],
    note: 'Made with the lips. Before one of these the conjunction וְ becomes וּ.',
  },
];

/** The two jobs of the dot, which looks the same either way. */
export interface DageshKind {
  id: 'lene' | 'forte';
  name: string;
  example: string;
  exampleGloss: string;
  does: string;
  where: string;
}

export const dageshKinds: DageshKind[] = [
  {
    id: 'lene',
    name: 'Dagesh lene',
    example: 'בַּ֫יִת',
    exampleGloss: 'house',
    does: 'Hardens a begadkephat letter. It does not double it.',
    where: 'Only in ב ג ד כ פ ת, and never directly after a vowel.',
  },
  {
    id: 'forte',
    name: 'Dagesh forte',
    example: 'הַמֶּ֫לֶךְ',
    exampleGloss: 'the king',
    does: 'Doubles the letter. In a begadkephat it hardens it as well.',
    where: 'Any letter except the gutturals and ר, and always directly after a vowel.',
  },
];

// ─── Vowels ───────────────────────────────────────────────────────────────────

/** The three historical classes. The i-class includes e; the u-class includes o. */
export type VowelClass = 'a' | 'i' | 'u';

/**
 * Rows of the chart. `vowel-letter` is a long vowel written with a ו or a י —
 * kept apart from `long` because those are the vowels that do not reduce when
 * the accent moves, which is the distinction noun and verb patterns turn on.
 */
export type VowelLength = 'short' | 'long' | 'vowel-letter' | 'reduced';

export const VOWEL_CLASSES: VowelClass[] = ['a', 'i', 'u'];
export const VOWEL_LENGTHS: VowelLength[] = ['short', 'long', 'vowel-letter', 'reduced'];

export const VOWEL_CLASS_LABELS: Record<VowelClass, string> = {
  a: 'A-class',
  i: 'I-class (i, e)',
  u: 'U-class (u, o)',
};

export const VOWEL_LENGTH_LABELS: Record<VowelLength, string> = {
  short: 'Short',
  long: 'Long',
  'vowel-letter': 'Long, with a vowel letter',
  reduced: 'Reduced',
};

export interface Vowel {
  name: string;
  /** The vowel on a host consonant — a point alone is a stray tick. */
  display: string;
  translit: string;
  /** Null for the sheva, which belongs to no class. */
  vowelClass: VowelClass | null;
  length: VowelLength;
  note?: string;
}

interface VowelFacts {
  vowelClass: VowelClass | null;
  length: VowelLength;
  /** Host to show the point on, when the pack's פ would be a form that never occurs. */
  host?: string;
  note?: string;
}

/**
 * Where each of the pack's thirteen points sits in the chart, keyed by name.
 *
 * The hatephs are shown on א rather than on the pack's פ: they exist to stand
 * under gutturals, and פֲ is a syllable no Hebrew word contains.
 */
const VOWEL_FACTS: Record<string, VowelFacts> = {
  patah: { vowelClass: 'a', length: 'short' },
  qamets: { vowelClass: 'a', length: 'long' },
  segol: { vowelClass: 'i', length: 'short' },
  tsere: { vowelClass: 'i', length: 'long' },
  hireq: { vowelClass: 'i', length: 'short' },
  holem: { vowelClass: 'u', length: 'long' },
  qibbuts: { vowelClass: 'u', length: 'short' },
  shureq: { vowelClass: 'u', length: 'vowel-letter' },
  'holem male': { vowelClass: 'u', length: 'vowel-letter' },
  sheva: { vowelClass: null, length: 'reduced' },
  'hateph patah': { vowelClass: 'a', length: 'reduced', host: 'א' },
  'hateph segol': { vowelClass: 'i', length: 'reduced', host: 'א' },
  'hateph qamets': { vowelClass: 'u', length: 'reduced', host: 'א' },
};

/**
 * Vowels the chart needs and `/write` does not.
 *
 * Qamets hatuf is absent from the pack on purpose — it is drawn exactly like a
 * qamets, so there is nothing to practise writing — but it is a different
 * vowel, and a chart without it has no short o. The two yod vowels are absent
 * because writing them is writing a hireq or a tsere and then a yod.
 */
const CHART_ONLY_VOWELS: Vowel[] = [
  {
    name: 'qamets hatuf',
    display: 'פָ',
    translit: 'o',
    vowelClass: 'u',
    length: 'short',
    note: 'Written exactly like qamets. It is the short o when the syllable is closed and unaccented.',
  },
  { name: 'tsere yod', display: 'פֵי', translit: 'ê', vowelClass: 'i', length: 'vowel-letter' },
  { name: 'hireq yod', display: 'פִי', translit: 'î', vowelClass: 'i', length: 'vowel-letter' },
];

function toVowel(glyph: WritableGlyph): Vowel {
  const facts = VOWEL_FACTS[glyph.name];
  if (!facts) throw new Error(`grammar: no vowel facts for ${glyph.name}`);
  return {
    name: glyph.name,
    display: facts.host ? facts.host + glyph.char : renderableText(hebrewScriptPack, glyph),
    translit: translitOf(glyph),
    vowelClass: facts.vowelClass,
    length: facts.length,
    ...(facts.note ? { note: facts.note } : {}),
  };
}

export const vowels: Vowel[] = [
  ...glyphsInGroup(hebrewScriptPack, 'vowel').map(toVowel),
  ...CHART_ONLY_VOWELS,
];

/** The vowels in one cell of the chart, in the order they were declared. */
export function vowelsAt(vowelClass: VowelClass, length: VowelLength): Vowel[] {
  return vowels.filter((v) => v.vowelClass === vowelClass && v.length === length);
}

export function getVowel(name: string): Vowel | undefined {
  return vowels.find((v) => v.name === name);
}

/** When the two dots are a sound and when they only close a syllable. */
export interface ShevaRule {
  kind: 'vocal' | 'silent';
  rule: string;
  example: string;
  exampleGloss: string;
}

export const shevaRules: ShevaRule[] = [
  {
    kind: 'vocal',
    rule: 'At the beginning of a word or a syllable.',
    example: 'בְּרִית',
    exampleGloss: 'covenant',
  },
  {
    kind: 'vocal',
    rule: 'The second of two in a row within a word.',
    example: 'יִשְׁמְרוּ',
    exampleGloss: 'they will keep',
  },
  {
    kind: 'vocal',
    rule: 'Under a letter with a dagesh forte.',
    example: 'קִטְּלוּ',
    exampleGloss: 'they slaughtered',
  },
  {
    kind: 'vocal',
    rule: 'After a long vowel that does not carry the accent.',
    example: 'שֹׁמְרִים',
    exampleGloss: 'keepers',
  },
  {
    kind: 'silent',
    rule: 'After a short vowel, closing the syllable.',
    example: 'מַלְכָּה',
    exampleGloss: 'queen',
  },
  {
    kind: 'silent',
    rule: 'The first of two in a row within a word.',
    example: 'יִשְׁמְרוּ',
    exampleGloss: 'they will keep',
  },
  {
    kind: 'silent',
    rule: 'At the end of a word.',
    example: 'מֶ֫לֶךְ',
    exampleGloss: 'king',
  },
];
