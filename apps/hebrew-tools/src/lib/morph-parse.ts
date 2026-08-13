/**
 * OSHB morph codes → readable parses.
 *
 * `src/data/morphhb.ts` ships without this deliberately: turning `HC/Vqw3ms`
 * into "and — Qal wayyiqtol 3ms" is a display concern that Daily Verse (#76)
 * and the Reader (#77) need together, and it wants its own tables and its own
 * tests rather than being guessed at ahead of its first use. This is that.
 *
 * Source of the tables: https://hb.openscriptures.org/parsing/HebrewMorphologyCodes.html
 * Every code the WLC actually uses is inventoried in `morph-codes.json` and
 * asserted against these tables, so the spec and the corpus are both witnesses.
 *
 * Three things to know before changing it:
 *
 * - **The stem letters mean different things in Hebrew and Aramaic.** `Vp` is
 *   Piel in Hebrew and Pael in Aramaic; `VH` is Hophal in both but `Vh` is
 *   Hiphil against Haphel. The language marker on `HebrewWord.parsing` selects
 *   the table, which is why every entry point here takes a language and none of
 *   them defaults to guessing from the code.
 *
 * - **An unrecognized letter in any slot fails the whole code**, rather than
 *   producing a parse with a hole in it. A caller can render the raw code and be
 *   obviously incomplete; it cannot detect "masculine singular" that should have
 *   read "masculine dual". `analyzeMorph` returns `null` and `formatMorph`
 *   falls back to the code itself.
 *
 * - **`x` is a real letter and means "not applicable"**, not "unknown" — a
 *   demonstrative pronoun is `Pdxms` because it has gender and number but no
 *   person. It is accepted in every slot and contributes nothing to the output.
 */

import { type HebrewWord, isAramaic, morphemes } from '../data/morphhb';

export type MorphLanguage = 'H' | 'A';

export interface MorphAnalysis {
  /** The segment as given, without the language marker. */
  code: string;
  language: MorphLanguage;
  /** The part of speech, named as a student would name it — "Noun", "Definite article". */
  pos: string;
  /** Everything else, spelled out: "Qal sequential imperfect 3rd masculine singular". */
  detail: string;
  /** The whole parse, compact enough to sit under a word: "Qal wayyiqtol 3ms". */
  brief: string;
  /** The binyan. Verbs only. */
  stem?: string;
}

// ─── Tables ───────────────────────────────────────────────────────────────────

/** Not applicable — a slot this part of speech does not inflect for. */
const NA = 'x';

const POS: Record<string, string> = {
  A: 'Adjective',
  C: 'Conjunction',
  D: 'Adverb',
  N: 'Noun',
  P: 'Pronoun',
  R: 'Preposition',
  S: 'Suffix',
  T: 'Particle',
  V: 'Verb',
};

/**
 * Sub-type letters, named as the thing itself rather than as a modifier: a
 * student reading `Td` is looking at the definite article, not at "a particle,
 * definite-article type". Common nouns and plain adjectives keep the bare name,
 * since "common" is what a noun is when nothing else is said.
 */
const SUBTYPE: Record<string, string> = {
  Aa: 'Adjective',
  Ac: 'Cardinal number',
  Ag: 'Gentilic adjective',
  Ao: 'Ordinal number',
  Nc: 'Noun',
  Ng: 'Gentilic noun',
  Np: 'Proper noun',
  Pd: 'Demonstrative pronoun',
  Pf: 'Indefinite pronoun',
  Pi: 'Interrogative pronoun',
  Pp: 'Personal pronoun',
  Pr: 'Relative pronoun',
  // Not "a preposition and an article": the article has assimilated into the
  // preposition and there is one letter on the page — בַּיָּמִים is `Rd/Ncmpa`.
  Rd: 'Preposition with the definite article',
  Sd: 'Directional he',
  Sh: 'Paragogic he',
  Sn: 'Paragogic nun',
  Sp: 'Pronominal suffix',
  Ta: 'Particle of affirmation',
  Td: 'Definite article',
  Te: 'Particle of exhortation',
  Ti: 'Interrogative particle',
  Tj: 'Interjection',
  Tm: 'Demonstrative particle',
  Tn: 'Negative particle',
  To: 'Direct object marker',
  Tr: 'Relative particle',
};

/** Parts of speech whose second letter is a sub-type rather than a feature. */
const TAKES_SUBTYPE = new Set(['A', 'N', 'P', 'R', 'S', 'T']);

const HEBREW_STEMS: Record<string, string> = {
  q: 'Qal',
  N: 'Niphal',
  p: 'Piel',
  P: 'Pual',
  h: 'Hiphil',
  H: 'Hophal',
  t: 'Hithpael',
  o: 'Polel',
  O: 'Polal',
  r: 'Hithpolel',
  m: 'Poel',
  M: 'Poal',
  k: 'Palel',
  K: 'Pulal',
  Q: 'Qal passive',
  l: 'Pilpel',
  L: 'Polpal',
  f: 'Hithpalpel',
  D: 'Nithpael',
  j: 'Pealal',
  i: 'Pilel',
  u: 'Hothpaal',
  c: 'Tiphil',
  v: 'Hishtaphel',
  w: 'Nithpalel',
  y: 'Nithpoel',
  z: 'Hithpoel',
};

const ARAMAIC_STEMS: Record<string, string> = {
  q: 'Peal',
  Q: 'Peil',
  u: 'Hithpeel',
  p: 'Pael',
  P: 'Ithpaal',
  M: 'Hithpaal',
  a: 'Aphel',
  h: 'Haphel',
  s: 'Saphel',
  e: 'Shaphel',
  H: 'Hophal',
  i: 'Ithpeel',
  t: 'Hishtaphel',
  v: 'Ishtaphel',
  w: 'Hithaphel',
  o: 'Polel',
  z: 'Ithpoel',
  r: 'Hithpolel',
  f: 'Hithpalpel',
  b: 'Hephal',
  c: 'Tiphel',
  m: 'Poel',
  l: 'Palpel',
  L: 'Ithpalpel',
  O: 'Ithpolel',
  G: 'Ittaphal',
};

/** What follows the conjugation letter: person-gender-number, or gender-number-state. */
type Inflection = 'finite' | 'participle' | 'none';

interface Conjugation {
  long: string;
  /**
   * The compact name.
   *
   * The four indicative conjugations take their Hebrew names, because a
   * sequential imperfect has no short English name worth the space and
   * "wayyiqtol" is both shorter and more precise. The volitives and the
   * non-finite forms keep the ordinary English abbreviations, which are already
   * what a grammar prints.
   */
  brief: string;
  inflection: Inflection;
}

const CONJUGATION: Record<string, Conjugation> = {
  p: { long: 'perfect', brief: 'qatal', inflection: 'finite' },
  q: { long: 'sequential perfect', brief: 'weqatal', inflection: 'finite' },
  i: { long: 'imperfect', brief: 'yiqtol', inflection: 'finite' },
  w: { long: 'sequential imperfect', brief: 'wayyiqtol', inflection: 'finite' },
  h: { long: 'cohortative', brief: 'coh', inflection: 'finite' },
  j: { long: 'jussive', brief: 'juss', inflection: 'finite' },
  v: { long: 'imperative', brief: 'impv', inflection: 'finite' },
  r: { long: 'active participle', brief: 'ptc', inflection: 'participle' },
  s: { long: 'passive participle', brief: 'pass ptc', inflection: 'participle' },
  a: { long: 'infinitive absolute', brief: 'inf abs', inflection: 'none' },
  c: { long: 'infinitive construct', brief: 'inf constr', inflection: 'none' },
};

const PERSON: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' };
/**
 * OSHB spends two letters here — `c` on verbs, where masculine and feminine are
 * not distinguished, and `b` on nouns, where the lemma is attested both ways.
 * Both are "common gender" in the terms a grammar uses, so both spell out that
 * way; the brief keeps the raw letter, so the distinction is still on screen.
 */
const GENDER: Record<string, string> = {
  m: 'masculine',
  f: 'feminine',
  c: 'common',
  b: 'common',
};
const NUMBER: Record<string, string> = { s: 'singular', p: 'plural', d: 'dual' };
const STATE: Record<string, string> = { a: 'absolute', c: 'construct', d: 'determined' };
/** Absolute is the unmarked state, so only the other two earn room in a brief. */
const STATE_BRIEF: Record<string, string> = { a: '', c: 'constr', d: 'det' };

// ─── Slot reading ─────────────────────────────────────────────────────────────

/** A slot's long name, `''` for `x`, or `null` — which fails the whole code. */
function slot(table: Record<string, string>, letter: string): string | null {
  if (letter === NA) return '';
  return table[letter] ?? null;
}

function join(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

/**
 * Read one morph segment — `Ncfsc`, `Vqw3ms`, `Sp3ms`, `Td`.
 *
 * Also accepts the coarse two-letter part of speech that `HebrewWord.pos`
 * carries (`Nc`, `Vq`), which is the same code with its features left off.
 */
export function analyzeMorph(code: string, language: MorphLanguage = 'H'): MorphAnalysis | null {
  if (!code) return null;
  return code[0] === 'V' ? analyzeVerb(code, language) : analyzeOther(code, language);
}

function analyzeVerb(code: string, language: MorphLanguage): MorphAnalysis | null {
  const stem = (language === 'A' ? ARAMAIC_STEMS : HEBREW_STEMS)[code[1]];
  if (!stem) return null;

  const base = { code, language, pos: POS.V, stem };
  // `Vq` alone is the head-morpheme part of speech, not a parse.
  if (code.length === 2) return { ...base, detail: stem, brief: stem };

  const conjugation = CONJUGATION[code[2]];
  if (!conjugation) return null;
  const rest = code.slice(3);

  if (conjugation.inflection === 'none') {
    if (rest) return null;
    return {
      ...base,
      detail: join([stem, conjugation.long]),
      brief: join([stem, conjugation.brief]),
    };
  }
  if (rest.length !== 3) return null;

  if (conjugation.inflection === 'participle') {
    const [gender, number, state] = [
      slot(GENDER, rest[0]),
      slot(NUMBER, rest[1]),
      slot(STATE, rest[2]),
    ];
    if (gender === null || number === null || state === null) return null;
    return {
      ...base,
      detail: join([stem, conjugation.long, gender, number, state]),
      brief: join([stem, conjugation.brief, briefGenderNumberState(rest)]),
    };
  }

  const [person, gender, number] = [
    slot(PERSON, rest[0]),
    slot(GENDER, rest[1]),
    slot(NUMBER, rest[2]),
  ];
  if (person === null || gender === null || number === null) return null;
  return {
    ...base,
    detail: join([stem, conjugation.long, person, gender, number]),
    brief: join([stem, conjugation.brief, briefLetters(rest)]),
  };
}

function analyzeOther(code: string, language: MorphLanguage): MorphAnalysis | null {
  const base = POS[code[0]];
  if (!base) return null;

  let pos = base;
  let rest = code.slice(1);
  if (rest && TAKES_SUBTYPE.has(code[0])) {
    const named = SUBTYPE[code.slice(0, 2)];
    if (named) pos = named;
    else if (code[1] !== NA) return null;
    rest = code.slice(2);
  }

  if (rest === '') return { code, language, pos, detail: '', brief: pos };
  if (rest.length !== 3) return null;

  // Nouns and adjectives inflect for state; pronouns and suffixes for person.
  // Nothing else inflects at all — a conjunction with three feature letters is
  // not a conjunction we understand.
  const nominal = code[0] === 'N' || code[0] === 'A';
  if (!nominal && code[0] !== 'P' && code[0] !== 'S') return null;

  const first = nominal ? slot(GENDER, rest[0]) : slot(PERSON, rest[0]);
  const second = nominal ? slot(NUMBER, rest[1]) : slot(GENDER, rest[1]);
  const third = nominal ? slot(STATE, rest[2]) : slot(NUMBER, rest[2]);
  if (first === null || second === null || third === null) return null;

  return {
    code,
    language,
    pos,
    detail: join([first, second, third]),
    brief: join([pos, nominal ? briefGenderNumberState(rest) : briefLetters(rest)]),
  };
}

/** The slot letters as a grammar would abbreviate them — `3ms`, dropping any `x`. */
function briefLetters(rest: string): string {
  return [...rest].filter((letter) => letter !== NA).join('');
}

function briefGenderNumberState(rest: string): string {
  return join([briefLetters(rest.slice(0, 2)), STATE_BRIEF[rest[2]]]);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** `Ncfsc` → "Noun — feminine singular construct". Unreadable codes come back as themselves. */
export function formatMorph(code: string, language: MorphLanguage = 'H'): string {
  const analysis = analyzeMorph(code, language);
  if (!analysis) return code;
  return analysis.detail ? `${analysis.pos} — ${analysis.detail}` : analysis.pos;
}

/** `Vqw3ms` → "Qal wayyiqtol 3ms". */
export function briefMorph(code: string, language: MorphLanguage = 'H'): string {
  return analyzeMorph(code, language)?.brief ?? code;
}

// ─── Whole words ──────────────────────────────────────────────────────────────

export interface MorphemeAnalysis {
  /** The morpheme's letters, without boundary markers. */
  text: string;
  /** Its morph code, without the language marker. */
  code: string;
  /** `null` when the code is not one these tables know. */
  analysis: MorphAnalysis | null;
}

/**
 * Take a word apart into morphemes, each with its own parse.
 *
 * This is the thing greek.tools has no analog for and the thing a first-year
 * student most needs to see: that וַיְהִי is וַ + יְהִי, and that the ל on לְדָוִד is a
 * preposition rather than part of the name.
 */
export function analyzeWord(word: Pick<HebrewWord, 'text' | 'parsing'>): MorphemeAnalysis[] {
  const language: MorphLanguage = isAramaic(word) ? 'A' : 'H';
  return morphemes(word).map(({ text, morph }) => ({
    text,
    code: morph,
    analysis: analyzeMorph(morph, language),
  }));
}

/** One line for a whole word: "Conjunction + Qal wayyiqtol 3ms". */
export function briefWord(word: Pick<HebrewWord, 'text' | 'parsing'>): string {
  return analyzeWord(word)
    .map((m) => m.analysis?.brief ?? m.code)
    .join(' + ');
}
