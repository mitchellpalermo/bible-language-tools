// Parsing practice on /parse (#82): what a verb form's parse is, which fields a
// student is asked, and how an answer is graded. Pure — the forms come from
// `src/data/parse-forms.ts`, the drawing from `components/VerbParse.tsx`.
//
// Every parse is OSHB's, never hand-written. What this file adds is the rules a
// student can be held to when a form is shown out of context:
//
// - **Every reading the text gives a spelling is right.** יִהְיֶה is a yiqtol in
//   one verse and a jussive in another; whichever is answered, it is correct.
//   The pool carries them all (`scripts/lib/parse-forms.mjs`).
// - **A form the shape cannot tell apart is right both ways** (`readingsOf`):
//   a prefixed 2ms is a 3fs (תִּכְתֹּב "you will write" / "she will write"), a
//   2fp a 3fp; a yiqtol may be read as a jussive (2nd and 3rd person) or a
//   cohortative (1st), and the reverse, because the volitive is read off the
//   verse; a qatal with a ו in front may be a weqatal, and a weqatal a qatal.
//   The corpus attests these where it happens to, and the rule fills the rest.
// - **The fields asked follow the conjugation the student picks**, as on
//   greek.tools' passage parser: a finite verb has person, gender and number, a
//   participle gender, number and state, an infinitive none of them. A form
//   is never asked for a field its parse does not carry, and the field set
//   gives nothing away before the conjugation is chosen.
// - **A miss is graded against the closest reading** (`gradeParse`), so a
//   student who read וַתֹּאמֶר as 2ms is told about the field they got wrong,
//   not marked down against the 3fs reading they did not choose.

import { shuffle } from '@tools/shared/flashcard-session';
import type { SessionLength } from '@tools/shared/parse-drill';
import { STEM_NAME_LABELS, STEM_NAMES, type StemName } from '../data/stem-patterns';
import { CONJUGATION_LABELS } from '../data/verb-paradigms';
import type { VerbConjugation } from '../data/vocabulary-types';
import { rootSearchKey } from './flashcard-filters';

// ─── Choices ──────────────────────────────────────────────────────────────────

export type ParseStem = StemName;

/** `VERB_CONJUGATIONS`, plus the two volitives a vocabulary card never shows. */
export type ParseConjugation = VerbConjugation | 'cohortative' | 'jussive';
export type ParsePerson = '1' | '2' | '3';
export type ParseGender = 'm' | 'f' | 'c';
export type ParseNumber = 's' | 'p';
export type ParseState = 'a' | 'c';

export const PARSE_STEMS: readonly ParseStem[] = STEM_NAMES;

/** In the order a grammar teaches them: the four indicatives, the volitives, the rest. */
export const PARSE_CONJUGATIONS: readonly ParseConjugation[] = [
  'qatal',
  'weqatal',
  'yiqtol',
  'wayyiqtol',
  'cohortative',
  'jussive',
  'imperative',
  'participle',
  'passive participle',
  'infinitive construct',
  'infinitive absolute',
];

export const PARSE_PERSONS: readonly ParsePerson[] = ['1', '2', '3'];
export const PARSE_GENDERS: readonly ParseGender[] = ['m', 'f', 'c'];
export const PARSE_NUMBERS: readonly ParseNumber[] = ['s', 'p'];
export const PARSE_STATES: readonly ParseState[] = ['a', 'c'];

/** The Stems tab's names (`STEM_NAME_LABELS`), so a stem is spelled one way in the app. */
export const STEM_LABELS: Record<ParseStem, string> = STEM_NAME_LABELS;

/** The paradigm quiz's names for the three it has; the rest as a grammar prints them. */
export const CONJUGATION_NAMES: Record<ParseConjugation, string> = {
  qatal: CONJUGATION_LABELS.qatal,
  weqatal: 'Weqatal',
  yiqtol: CONJUGATION_LABELS.yiqtol,
  wayyiqtol: CONJUGATION_LABELS.wayyiqtol,
  cohortative: 'Cohortative',
  jussive: 'Jussive',
  imperative: 'Imperative',
  participle: 'Participle',
  'passive participle': 'Passive participle',
  'infinitive construct': 'Infinitive construct',
  'infinitive absolute': 'Infinitive absolute',
};

export const PERSON_LABELS: Record<ParsePerson, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
export const GENDER_LABELS: Record<ParseGender, string> = {
  m: 'Masculine',
  f: 'Feminine',
  c: 'Common',
};
export const NUMBER_LABELS: Record<ParseNumber, string> = { s: 'Singular', p: 'Plural' };
export const STATE_LABELS: Record<ParseState, string> = { a: 'Absolute', c: 'Construct' };

// ─── Reading an OSHB code ─────────────────────────────────────────────────────

/** OSHB's stem letter, for the seven stems the pool holds. Mirrors `PARSE_STEM_LETTERS`. */
export const STEM_LETTERS: Record<string, ParseStem> = {
  q: 'qal',
  N: 'niphal',
  p: 'piel',
  P: 'pual',
  t: 'hithpael',
  h: 'hiphil',
  H: 'hophal',
};

/** OSHB's conjugation letter. */
export const CONJUGATION_LETTERS: Record<string, ParseConjugation> = {
  p: 'qatal',
  q: 'weqatal',
  i: 'yiqtol',
  w: 'wayyiqtol',
  h: 'cohortative',
  j: 'jussive',
  v: 'imperative',
  r: 'participle',
  s: 'passive participle',
  c: 'infinitive construct',
  a: 'infinitive absolute',
};

/** Which inflection a conjugation carries after its letter. */
export type Inflection = 'finite' | 'participle' | 'none';

export function inflectionOf(conjugation: ParseConjugation): Inflection {
  if (conjugation === 'participle' || conjugation === 'passive participle') return 'participle';
  if (conjugation.startsWith('infinitive')) return 'none';
  return 'finite';
}

/** One parse of a verb form. */
export interface VerbReading {
  /** The lemma key into `lemmas.json`. */
  lemma: string;
  /** The OSHB code, prefixes included and language letter dropped: `C/Vqw3ms`. */
  morph: string;
  stem: ParseStem;
  conjugation: ParseConjugation;
  person?: ParsePerson;
  gender?: ParseGender;
  number?: ParseNumber;
  state?: ParseState;
  /** Whether a conjunction is prefixed — what lets a qatal be read as a weqatal. */
  conjunction: boolean;
}

const oneOf = <T extends string>(list: readonly T[], value: string): T | null =>
  (list as readonly string[]).includes(value) ? (value as T) : null;

/**
 * One OSHB code as a reading, or `null` when any letter is not one the drill
 * offers — the same rule as `analyzeMorph`: a parse with a hole in it cannot be
 * told from a right one.
 */
export function readVerbMorph(lemma: string, morph: string): VerbReading | null {
  const segments = morph.split('/');
  const code = segments[segments.length - 1];
  if (code[0] !== 'V') return null;
  const stem = STEM_LETTERS[code[1]];
  const conjugation = CONJUGATION_LETTERS[code[2]];
  if (!stem || !conjugation) return null;
  const reading: VerbReading = {
    lemma,
    morph,
    stem,
    conjugation,
    conjunction: segments.slice(0, -1).includes('C'),
  };
  const rest = code.slice(3);
  const inflection = inflectionOf(conjugation);
  if (inflection === 'none') return rest === '' ? reading : null;
  if (rest.length !== 3) return null;
  if (inflection === 'participle') {
    const gender = oneOf(PARSE_GENDERS, rest[0]);
    const number = oneOf(PARSE_NUMBERS, rest[1]);
    const state = oneOf(PARSE_STATES, rest[2]);
    return gender && number && state ? { ...reading, gender, number, state } : null;
  }
  const person = oneOf(PARSE_PERSONS, rest[0]);
  const gender = oneOf(PARSE_GENDERS, rest[1]);
  const number = oneOf(PARSE_NUMBERS, rest[2]);
  return person && gender && number ? { ...reading, person, gender, number } : null;
}

// ─── Forms ────────────────────────────────────────────────────────────────────

/** A lemma's headword and its root, as the pool carries them. */
export interface ParseLemma {
  headword: string;
  root: string;
}

/** One spelling to parse, with every reading the text gives it. */
export interface ParseItem {
  /** Pointed, unaccented, NFC — prefixes included. */
  form: string;
  /** The text's readings, most frequent first, then readings witnessed elsewhere. */
  readings: VerbReading[];
}

/** The reading a form is filed under: the one the text uses it in most. */
export const primaryReading = (item: ParseItem): VerbReading => item.readings[0];

const PREFIXED: readonly ParseConjugation[] = ['yiqtol', 'wayyiqtol', 'jussive'];

/** The person-gender-number pairs a prefixed conjugation spells identically. */
const SAME_SPELLING: Record<string, [ParsePerson, ParseGender, ParseNumber]> = {
  '2ms': ['3', 'f', 's'],
  '3fs': ['2', 'm', 's'],
  '2fp': ['3', 'f', 'p'],
  '3fp': ['2', 'f', 'p'],
};

/** Other conjugations a reading can be given out of context. */
function alsoConjugations(r: VerbReading): ParseConjugation[] {
  switch (r.conjugation) {
    case 'yiqtol':
      return r.person === '1' ? ['cohortative'] : ['jussive'];
    case 'jussive':
    case 'cohortative':
      return ['yiqtol'];
    case 'weqatal':
      return ['qatal'];
    case 'qatal':
      return r.conjunction ? ['weqatal'] : [];
    default:
      return [];
  }
}

const readingKey = (r: VerbReading) =>
  [r.lemma, r.stem, r.conjugation, r.person, r.gender, r.number, r.state].join('|');

/**
 * Every reading an answer may match: the text's own, then what the shape
 * cannot tell apart from them (see the top of the file). In that order, so
 * ties in `gradeParse` go to what the text actually says.
 */
export function readingsOf(item: ParseItem): VerbReading[] {
  const out = new Map<string, VerbReading>();
  const add = (r: VerbReading) => {
    if (!out.has(readingKey(r))) out.set(readingKey(r), r);
  };
  for (const r of item.readings) add(r);
  for (const r of [...out.values()]) {
    const conjugations = [r.conjugation, ...alsoConjugations(r)];
    for (const conjugation of conjugations) {
      const swap = PREFIXED.includes(conjugation)
        ? SAME_SPELLING[`${r.person}${r.gender}${r.number}`]
        : undefined;
      add({ ...r, conjugation });
      if (swap) add({ ...r, conjugation, person: swap[0], gender: swap[1], number: swap[2] });
    }
  }
  return [...out.values()];
}

// ─── Answers ──────────────────────────────────────────────────────────────────

export type ParseFieldKey = 'stem' | 'conjugation' | 'person' | 'gender' | 'number' | 'state';

export interface ParseAnswer {
  stem: ParseStem | '';
  conjugation: ParseConjugation | '';
  person: ParsePerson | '';
  gender: ParseGender | '';
  number: ParseNumber | '';
  state: ParseState | '';
  /** Typed, raw (final forms not applied). Ignored when the root is not asked. */
  root: string;
}

export function emptyAnswer(): ParseAnswer {
  return { stem: '', conjugation: '', person: '', gender: '', number: '', state: '', root: '' };
}

const INFLECTION_FIELDS: Record<Inflection, ParseFieldKey[]> = {
  finite: ['person', 'gender', 'number'],
  participle: ['gender', 'number', 'state'],
  none: [],
};

/** The fields a conjugation is asked, in the order a parse is given. Stem and conjugation always. */
export function fieldsFor(conjugation: ParseConjugation | ''): ParseFieldKey[] {
  if (!conjugation) return ['stem', 'conjugation'];
  return ['stem', 'conjugation', ...INFLECTION_FIELDS[inflectionOf(conjugation)]];
}

/**
 * A new conjugation keeps the fields both share and clears the rest, so
 * switching between yiqtol and participle keeps the gender and number chosen.
 */
export function withConjugation(answer: ParseAnswer, conjugation: ParseConjugation): ParseAnswer {
  const keep = new Set(fieldsFor(conjugation));
  const next: ParseAnswer = { ...answer, conjugation };
  for (const key of ['person', 'gender', 'number', 'state'] as const) {
    if (!keep.has(key)) next[key] = '';
  }
  return next;
}

/** Whether every field the chosen conjugation asks has an answer. */
export function isComplete(answer: ParseAnswer, askRoot: boolean): boolean {
  if (!answer.conjugation) return false;
  if (askRoot && rootSearchKey(answer.root) === '') return false;
  return fieldsFor(answer.conjugation).every((key) => answer[key] !== '');
}

/** The roots a reading's lemma may be answered with: the lexicon's, and the headword's consonants. */
export function rootKeys(lemma: ParseLemma | undefined): string[] {
  if (!lemma) return [];
  return [...new Set([lemma.root, lemma.headword].map(rootSearchKey).filter(Boolean))];
}

/** A field's result: `true`/`false` where asked, absent where not. */
export type ParseFieldResults = Partial<Record<ParseFieldKey | 'root', boolean>>;

export interface ParseGrade extends ParseFieldResults {
  allCorrect: boolean;
  /** The reading the answer was graded against: an exact match, else the closest. */
  reading: VerbReading;
  /** True when `reading` is not the text's own, but one the shape allows. */
  alsoAccepted: boolean;
}

function marks(
  reading: VerbReading,
  answer: ParseAnswer,
  root: boolean | undefined,
): ParseFieldResults {
  const out: ParseFieldResults = {};
  for (const key of fieldsFor(reading.conjugation)) out[key] = answer[key] === reading[key];
  if (root !== undefined) out.root = root;
  return out;
}

const score = (m: ParseFieldResults) => Object.values(m).filter(Boolean).length;

/**
 * Grade an answer field by field against the closest reading the form allows.
 * `lemmas` gives each reading's root; pass `askRoot: false` to leave it out.
 */
export function gradeParse(
  item: ParseItem,
  answer: ParseAnswer,
  lemmas: Record<string, ParseLemma>,
  askRoot: boolean,
): ParseGrade {
  const own = new Set(item.readings.map(readingKey));
  const typed = rootSearchKey(answer.root);
  let best: { reading: VerbReading; marks: ParseFieldResults } | null = null;
  for (const reading of readingsOf(item)) {
    const root = askRoot ? rootKeys(lemmas[reading.lemma]).includes(typed) : undefined;
    const m = marks(reading, answer, root);
    if (!best || score(m) > score(best.marks)) best = { reading, marks: m };
  }
  const { reading, marks: m } = best as NonNullable<typeof best>;
  return {
    ...m,
    allCorrect: Object.values(m).every(Boolean),
    reading,
    alsoAccepted: !own.has(readingKey(reading)),
  };
}

/** A reading spelled out: "Qal Wayyiqtol 3rd Masculine Singular". */
export function describeReading(r: VerbReading): string {
  const parts = [STEM_LABELS[r.stem], CONJUGATION_NAMES[r.conjugation]];
  if (r.person) parts.push(PERSON_LABELS[r.person]);
  if (r.gender) parts.push(GENDER_LABELS[r.gender]);
  if (r.number) parts.push(NUMBER_LABELS[r.number]);
  if (r.state) parts.push(STATE_LABELS[r.state]);
  return parts.join(' ');
}

// ─── The attempt log ──────────────────────────────────────────────────────────

const CONCEPT_PREFIX = 'parse/verb/';

/**
 * The attempt-log concept for one kind of verb form: stem and conjugation,
 * `parse/verb/qal-wayyiqtol`, `parse/verb/niphal-infinitive-construct`. The
 * shape of greek.tools' `parse/paradigm/<tense>-<voice>-<mood>`: the things a
 * student confuses, without person, gender and number, which would split one
 * habit's history into ten. **Stable: renaming one splits its history.**
 */
export function parseVerbConcept(r: Pick<VerbReading, 'stem' | 'conjugation'>): string {
  return `${CONCEPT_PREFIX}${r.stem}-${r.conjugation.replace(/ /g, '-')}`;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface ParseSettings {
  stems: ParseStem[];
  conjugations: ParseConjugation[];
  /** Whether the root is asked too. */
  askRoot: boolean;
  sessionLength: SessionLength;
}

/**
 * Qal, in the three conjugations the paradigm quiz has: where a first-year
 * course starts. The other stems and conjugations are a tap away.
 */
const DEFAULTS: ParseSettings = {
  stems: ['qal'],
  conjugations: ['qatal', 'yiqtol', 'wayyiqtol'],
  askRoot: true,
  sessionLength: 20,
};
export const DEFAULT_PARSE_SETTINGS: Readonly<ParseSettings> = Object.freeze(DEFAULTS);

/** The forms a session may ask: those the text uses most as one of the chosen stems and conjugations. */
export function eligibleItems(
  items: readonly ParseItem[],
  { stems, conjugations }: Pick<ParseSettings, 'stems' | 'conjugations'>,
): ParseItem[] {
  return items.filter((item) => {
    const r = primaryReading(item);
    return stems.includes(r.stem) && conjugations.includes(r.conjugation);
  });
}

/** `count` forms drawn at random from those the settings allow. */
export function buildSession(
  items: readonly ParseItem[],
  settings: ParseSettings,
  random: () => number = Math.random,
): ParseItem[] {
  return shuffle(eligibleItems(items, settings), random).slice(0, settings.sessionLength);
}
