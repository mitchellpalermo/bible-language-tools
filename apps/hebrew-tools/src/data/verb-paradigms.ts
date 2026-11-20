// Verb paradigms — the answer key for the paradigm quiz (ROADMAP Phase 7,
// issue #80) and the tables the Grammar Reference (Phase 6) renders.
//
// Four things are load-bearing and none is obvious:
//
// **Two sources, named per paradigm.** The Qal qatal, yiqtol and wayyiqtol are
// transcribed from Garrett & DeRouchie, *A Modern Grammar for Biblical Hebrew*,
// from the tables named in each paradigm's `source`. Everything added since
// (6d, #153: the weqatal, imperative, infinitives and participles) is written
// from general grammar, `source: GENERAL_GRAMMAR`, as the rest of the Grammar
// Reference is; the pull request that added each lists the cells where
// grammars disagree, for checking against the textbook. None of it can be
// generated from OSHB — קטל, the model strong verb, is barely attested, and a
// paradigm cell is the *regular* form whether or not Scripture uses it.
// `verb-paradigms.test.ts` checks every form against the corpus *with its
// parse* when the corpus is present, which catches a slip and a form in the
// wrong cell without making the corpus the source.
//
// **A form is keyed by what it inflects for, never by row and column.** A
// finite form by person-gender-number (`3ms`), a participle by gender-number
// (`ms`), an infinitive by `inf` (`FormKey`). The textbook prints the same
// paradigm two ways — one verb as person × number (Table 10.8), and several
// verb classes side by side as PGN × class (Tables 9.6, 10.7). Keying by form
// is what lets one paradigm render in either layout, and the quiz's cell id
// (`<paradigm>:<key>`) is built from it, so a student's progress stays
// attached to the form. Never rename a key or a paradigm id.
//
// **Forms are stored as printed, stress mark included.** The textbook marks
// penultimate stress (קָטַ֫לְתָּ), and that is worth showing in a reference
// table. Nobody types it, so anything that *grades* against these must compare
// `answerForm()`, not the raw string. Every string here is NFC — the test pins
// that — because a dagesh typed before its vowel and one typed after are the
// same letter and must compare equal.

import { stripCantillation } from '../lib/hebrew-input';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Person, gender, number. `c` is common gender: the qatal has one third-person
 * plural (3cp) where the prefixed conjugations distinguish 3mp from 3fp.
 */
export type Pgn =
  | '3ms'
  | '3fs'
  | '2ms'
  | '2fs'
  | '1cs'
  | '3cp'
  | '3mp'
  | '3fp'
  | '2mp'
  | '2fp'
  | '1cp';

/** Gender and number: what a participle inflects for, like a noun. */
export type Gn = 'ms' | 'fs' | 'mp' | 'fp';

/**
 * What a form is keyed by: person-gender-number for a finite verb, gender-
 * number for a participle, `inf` for an infinitive, which has one form.
 */
export type FormKey = Pgn | Gn | 'inf';

export type Stem = 'qal';

export type Conjugation =
  | 'qatal'
  | 'yiqtol'
  | 'wayyiqtol'
  | 'weqatal'
  | 'imperative'
  | 'infinitive-construct'
  | 'infinitive-absolute'
  | 'participle-active'
  | 'participle-passive';

/**
 * What kind of root the paradigm models. `hayah` is its own class rather than
 * an instance of `iii-he`: the textbook teaches היה as a verb to memorize, and
 * its guttural first radical changes the pointing (הֱיִיתֶם, not בְּנִיתֶם).
 */
export type VerbClass = 'strong' | 'begadkephat' | 'iii-he' | 'hayah';

export interface VerbParadigm {
  /** `<stem>-<conjugation>-<verbClass>` — stable, used in SRS keys. */
  id: string;
  stem: Stem;
  conjugation: Conjugation;
  verbClass: VerbClass;
  /** The root, unpointed. */
  root: string;
  /** English gloss of the root's Qal, as a bare infinitive. */
  gloss: string;
  /** The textbook table it was transcribed from, or `GENERAL_GRAMMAR`. */
  source: string;
  /** Absent keys are forms the conjugation does not have (no 3cp in the yiqtol). */
  forms: Partial<Record<FormKey, string>>;
}

/** The `source` of a paradigm written from general grammar, not transcribed. */
export const GENERAL_GRAMMAR = 'General grammar';

/** A prefixed conjugation's affixes: what goes before the root, and after. */
export interface Affix {
  prefix: string;
  suffix: string;
}

// ─── Labels and ordering ──────────────────────────────────────────────────────

/** Textbook row order for the suffixed conjugation (Table 9.6). */
export const QATAL_PGNS: Pgn[] = ['3ms', '3fs', '2ms', '2fs', '1cs', '3cp', '2mp', '2fp', '1cp'];

/** Textbook row order for the prefixed conjugations (Table 10.7). */
export const PREFIXED_PGNS: Pgn[] = [
  '3ms',
  '3fs',
  '2ms',
  '2fs',
  '1cs',
  '3mp',
  '3fp',
  '2mp',
  '2fp',
  '1cp',
];

/** The imperative is second person only. */
export const IMPERATIVE_PGNS: Pgn[] = ['2ms', '2fs', '2mp', '2fp'];

/** A participle's forms, in the order a noun's are given. */
export const GN_KEYS: Gn[] = ['ms', 'fs', 'mp', 'fp'];

/** The forms each conjugation has, in the order a table lists them. */
export const CONJUGATION_KEYS: Record<Conjugation, FormKey[]> = {
  qatal: QATAL_PGNS,
  yiqtol: PREFIXED_PGNS,
  wayyiqtol: PREFIXED_PGNS,
  weqatal: QATAL_PGNS,
  imperative: IMPERATIVE_PGNS,
  'infinitive-construct': ['inf'],
  'infinitive-absolute': ['inf'],
  'participle-active': GN_KEYS,
  'participle-passive': GN_KEYS,
};

const PGN_KEYS = new Set<string>([...QATAL_PGNS, ...PREFIXED_PGNS]);

export function isPgn(key: FormKey): key is Pgn {
  return PGN_KEYS.has(key);
}

/** A PGN spelled out, for a caption under a table — "3rd masculine singular". */
const PERSON_NAMES: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' };
const GENDER_NAMES: Record<string, string> = { m: 'masculine', f: 'feminine', c: 'common' };
const NUMBER_NAMES: Record<string, string> = { s: 'singular', p: 'plural' };

/** A PGN spelled out, for a caption under a table — "3rd masculine singular". */
export function pgnLabel(pgn: Pgn): string {
  return `${PERSON_NAMES[pgn[0]]} ${GENDER_NAMES[pgn[1]]} ${NUMBER_NAMES[pgn[2]]}`;
}

/** Any form key spelled out: "3rd masculine singular", "feminine plural", "infinitive". */
export function formKeyLabel(key: FormKey): string {
  if (key === 'inf') return 'infinitive';
  if (isPgn(key)) return pgnLabel(key);
  return `${GENDER_NAMES[key[0]]} ${NUMBER_NAMES[key[1]]}`;
}

export const CONJUGATION_LABELS: Record<Conjugation, string> = {
  qatal: 'Qatal (Perfect)',
  yiqtol: 'Yiqtol (Imperfect)',
  wayyiqtol: 'Wayyiqtol',
  weqatal: 'Weqatal',
  imperative: 'Imperative',
  'infinitive-construct': 'Infinitive Construct',
  'infinitive-absolute': 'Infinitive Absolute',
  'participle-active': 'Active Participle',
  'participle-passive': 'Passive Participle',
};

export const VERB_CLASS_LABELS: Record<VerbClass, string> = {
  strong: 'Strong',
  begadkephat: 'Begadkephat',
  'iii-he': 'III-ה',
  hayah: 'היה',
};

export const STEM_LABELS: Record<Stem, string> = {
  qal: 'Qal',
};

// ─── Affixes ──────────────────────────────────────────────────────────────────

/**
 * Qatal sufformatives (Table 9.6, first column). The 3ms has none, which is an
 * empty string rather than a missing key: "nothing" is the answer.
 */
export const QATAL_SUFFORMATIVES: Record<(typeof QATAL_PGNS)[number], string> = {
  '3ms': '',
  '3fs': 'ָה',
  '2ms': 'תָּ',
  '2fs': 'תְּ',
  '1cs': 'תִּי',
  '3cp': 'וּ',
  '2mp': 'תֶּם',
  '2fp': 'תֶּן',
  '1cp': 'נוּ',
} as Record<Pgn, string>;

/**
 * Yiqtol preformatives and sufformatives (Table 10.7, first column). The
 * preformative is the bare consonant: its vowel belongs to the stem and the
 * root class, not to the person.
 */
export const YIQTOL_AFFIXES: Partial<Record<Pgn, Affix>> = {
  '3ms': { prefix: 'י', suffix: '' },
  '3fs': { prefix: 'ת', suffix: '' },
  '2ms': { prefix: 'ת', suffix: '' },
  '2fs': { prefix: 'ת', suffix: 'ִי' },
  '1cs': { prefix: 'א', suffix: '' },
  '3mp': { prefix: 'י', suffix: 'וּ' },
  '3fp': { prefix: 'ת', suffix: 'נָה' },
  '2mp': { prefix: 'ת', suffix: 'וּ' },
  '2fp': { prefix: 'ת', suffix: 'נָה' },
  '1cp': { prefix: 'נ', suffix: '' },
};

// ─── Paradigms ────────────────────────────────────────────────────────────────

function paradigm(
  conjugation: Conjugation,
  verbClass: VerbClass,
  root: string,
  gloss: string,
  source: string,
  forms: Partial<Record<FormKey, string>>,
): VerbParadigm {
  return {
    id: paradigmId('qal', conjugation, verbClass),
    stem: 'qal',
    conjugation,
    verbClass,
    root,
    gloss,
    source,
    forms,
  };
}

export function paradigmId(stem: Stem, conjugation: Conjugation, verbClass: VerbClass): string {
  return `${stem}-${conjugation}-${verbClass}`;
}

export const verbParadigms: VerbParadigm[] = [
  // ── Qal qatal ──────────────────────────────────────────────────────────────
  paradigm('qatal', 'strong', 'קטל', 'kill', 'Table 9.6', {
    '3ms': 'קָטַל',
    '3fs': 'קָטְלָה',
    '2ms': 'קָטַ֫לְתָּ',
    '2fs': 'קָטַלְתְּ',
    '1cs': 'קָטַ֫לְתִּי',
    '3cp': 'קָטְלוּ',
    '2mp': 'קְטַלְתֶּם',
    '2fp': 'קְטַלְתֶּן',
    '1cp': 'קָטַ֫לְנוּ',
  }),
  paradigm('qatal', 'begadkephat', 'כתב', 'write', 'Table 9.6', {
    '3ms': 'כָּתַב',
    '3fs': 'כָּתְבָה',
    '2ms': 'כָּתַ֫בְתָּ',
    '2fs': 'כָּתַבְתְּ',
    '1cs': 'כָּתַ֫בְתִּי',
    '3cp': 'כָּתְבוּ',
    '2mp': 'כְּתַבְתֶּם',
    '2fp': 'כְּתַבְתֶּן',
    '1cp': 'כָּתַ֫בְנוּ',
  }),
  paradigm('qatal', 'iii-he', 'בנה', 'build', 'Table 9.6', {
    '3ms': 'בָּנָה',
    '3fs': 'בָּנְתָה',
    '2ms': 'בָּנִ֫יתָ',
    '2fs': 'בָּנִית',
    '1cs': 'בָּנִ֫יתִי',
    '3cp': 'בָּנוּ',
    '2mp': 'בְּנִיתֶם',
    '2fp': 'בְּנִיתֶן',
    '1cp': 'בָּנִ֫ינוּ',
  }),
  paradigm('qatal', 'hayah', 'היה', 'be', 'Table 10.8', {
    '3ms': 'הָיָה',
    '3fs': 'הָיְתָה',
    '2ms': 'הָיִ֫יתָ',
    '2fs': 'הָיִית',
    '1cs': 'הָיִ֫יתִי',
    '3cp': 'הָיוּ',
    '2mp': 'הֱיִיתֶם',
    '2fp': 'הֱיִיתֶן',
    '1cp': 'הָיִ֫ינוּ',
  }),

  // ── Qal yiqtol ─────────────────────────────────────────────────────────────
  paradigm('yiqtol', 'strong', 'קטל', 'kill', 'Table 10.7', {
    '3ms': 'יִקְטֹל',
    '3fs': 'תִּקְטֹל',
    '2ms': 'תִּקְטֹל',
    '2fs': 'תִּקְטְלִי',
    '1cs': 'אֶקְטֹל',
    '3mp': 'יִקְטְלוּ',
    '3fp': 'תִּקְטֹ֫לְנָה',
    '2mp': 'תִּקְטְלוּ',
    '2fp': 'תִּקְטֹ֫לְנָה',
    '1cp': 'נִקְטֹל',
  }),
  paradigm('yiqtol', 'begadkephat', 'כתב', 'write', 'Table 10.7', {
    '3ms': 'יִכְתֹּב',
    '3fs': 'תִּכְתֹּב',
    '2ms': 'תִּכְתֹּב',
    '2fs': 'תִּכְתְּבִי',
    '1cs': 'אֶכְתֹּב',
    '3mp': 'יִכְתְּבוּ',
    '3fp': 'תִּכְתֹּ֫בְנָה',
    '2mp': 'תִּכְתְּבוּ',
    '2fp': 'תִּכְתֹּ֫בְנָה',
    '1cp': 'נִכְתֹּב',
  }),
  paradigm('yiqtol', 'iii-he', 'בנה', 'build', 'Tables 10.7, 11.4', {
    '3ms': 'יִבְנֶה',
    '3fs': 'תִּבְנֶה',
    '2ms': 'תִּבְנֶה',
    '2fs': 'תִּבְנִי',
    '1cs': 'אֶבְנֶה',
    '3mp': 'יִבְנוּ',
    '3fp': 'תִּבְנֶ֫ינָה',
    '2mp': 'תִּבְנוּ',
    '2fp': 'תִּבְנֶ֫ינָה',
    '1cp': 'נִבְנֶה',
  }),
  paradigm('yiqtol', 'hayah', 'היה', 'be', 'Table 10.8', {
    '3ms': 'יִהְיֶה',
    '3fs': 'תִּהְיֶה',
    '2ms': 'תִּהְיֶה',
    '2fs': 'תִּהְיִי',
    '1cs': 'אֶהְיֶה',
    '3mp': 'יִהְיוּ',
    '3fp': 'תִּהְיֶ֫ינָה',
    '2mp': 'תִּהְיוּ',
    '2fp': 'תִּהְיֶ֫ינָה',
    '1cp': 'נִהְיֶה',
  }),

  // ── Qal wayyiqtol ──────────────────────────────────────────────────────────
  paradigm('wayyiqtol', 'strong', 'קטל', 'kill', 'Table 11.3', {
    '3ms': 'וַיִּקְטֹל',
    '3fs': 'וַתִּקְטֹל',
    '2ms': 'וַתִּקְטֹל',
    '2fs': 'וַתִּקְטְלִי',
    '1cs': 'וָאֶקְטֹל',
    '3mp': 'וַיִּקְטְלוּ',
    '3fp': 'וַתִּקְטֹ֫לְנָה',
    '2mp': 'וַתִּקְטְלוּ',
    '2fp': 'וַתִּקְטֹ֫לְנָה',
    '1cp': 'וַנִּקְטֹל',
  }),
  // The III-ה wayyiqtol is the one paradigm here whose forms are not the yiqtol
  // with וַ in front: where the yiqtol has no sufformative the final ה drops and
  // the stress retreats (וַיִּ֫בֶן, not וַיִּבְנֶה). The 1cs and 1cp keep the long
  // form, as Table 11.4 prints them.
  paradigm('wayyiqtol', 'iii-he', 'בנה', 'build', 'Table 11.4', {
    '3ms': 'וַיִּ֫בֶן',
    '3fs': 'וַתִּ֫בֶן',
    '2ms': 'וַתִּ֫בֶן',
    '2fs': 'וַתִּבְנִי',
    '1cs': 'וָאֶבְנֶה',
    '3mp': 'וַיִּבְנוּ',
    '3fp': 'וַתִּבְנֶ֫ינָה',
    '2mp': 'וַתִּבְנוּ',
    '2fp': 'וַתִּבְנֶ֫ינָה',
    '1cp': 'וַנִּבְנֶה',
  }),

  // ── Written from general grammar (6d, #153) ────────────────────────────────
  //
  // The strong verb and the begadkephat one, as for the qatal and yiqtol. The
  // stress mark is printed wherever the stress is not on the last syllable,
  // and in the weqatal also where it has moved *to* the last syllable, which
  // is the thing a weqatal table exists to show.

  // ── Qal weqatal ────────────────────────────────────────────────────────────
  // The qatal with וְ, which becomes וּ before a vocal sheva (the 2mp and 2fp)
  // and takes the begadkephat's dagesh lene away. In the 2ms and 1cs the
  // stress moves to the last syllable.
  paradigm('weqatal', 'strong', 'קטל', 'kill', GENERAL_GRAMMAR, {
    '3ms': 'וְקָטַל',
    '3fs': 'וְקָטְלָה',
    '2ms': 'וְקָטַלְתָּ֫',
    '2fs': 'וְקָטַלְתְּ',
    '1cs': 'וְקָטַלְתִּ֫י',
    '3cp': 'וְקָטְלוּ',
    '2mp': 'וּקְטַלְתֶּם',
    '2fp': 'וּקְטַלְתֶּן',
    '1cp': 'וְקָטַ֫לְנוּ',
  }),
  paradigm('weqatal', 'begadkephat', 'כתב', 'write', GENERAL_GRAMMAR, {
    '3ms': 'וְכָתַב',
    '3fs': 'וְכָתְבָה',
    '2ms': 'וְכָתַבְתָּ֫',
    '2fs': 'וְכָתַבְתְּ',
    '1cs': 'וְכָתַבְתִּ֫י',
    '3cp': 'וְכָתְבוּ',
    '2mp': 'וּכְתַבְתֶּם',
    '2fp': 'וּכְתַבְתֶּן',
    '1cp': 'וְכָתַ֫בְנוּ',
  }),

  // ── Qal imperative ─────────────────────────────────────────────────────────
  // The yiqtol without its preformative. Where a vowel ending follows, the two
  // shewas that would meet at the front resolve to hireq (קִטְלִי).
  paradigm('imperative', 'strong', 'קטל', 'kill', GENERAL_GRAMMAR, {
    '2ms': 'קְטֹל',
    '2fs': 'קִטְלִי',
    '2mp': 'קִטְלוּ',
    '2fp': 'קְטֹ֫לְנָה',
  }),
  paradigm('imperative', 'begadkephat', 'כתב', 'write', GENERAL_GRAMMAR, {
    '2ms': 'כְּתֹב',
    '2fs': 'כִּתְבִי',
    '2mp': 'כִּתְבוּ',
    '2fp': 'כְּתֹ֫בְנָה',
  }),

  // ── Qal infinitives ────────────────────────────────────────────────────────
  paradigm('infinitive-construct', 'strong', 'קטל', 'kill', GENERAL_GRAMMAR, { inf: 'קְטֹל' }),
  paradigm('infinitive-construct', 'begadkephat', 'כתב', 'write', GENERAL_GRAMMAR, {
    inf: 'כְּתֹב',
  }),
  paradigm('infinitive-absolute', 'strong', 'קטל', 'kill', GENERAL_GRAMMAR, { inf: 'קָטוֹל' }),
  paradigm('infinitive-absolute', 'begadkephat', 'כתב', 'write', GENERAL_GRAMMAR, {
    inf: 'כָּתוֹב',
  }),

  // ── Qal participles ────────────────────────────────────────────────────────
  // They inflect like nouns. The active has holem in the first syllable, the
  // passive shureq in the second, which keeps its long vowel when the first
  // reduces.
  paradigm('participle-active', 'strong', 'קטל', 'kill', GENERAL_GRAMMAR, {
    ms: 'קֹטֵל',
    fs: 'קֹטֶ֫לֶת',
    mp: 'קֹטְלִים',
    fp: 'קֹטְלוֹת',
  }),
  paradigm('participle-active', 'begadkephat', 'כתב', 'write', GENERAL_GRAMMAR, {
    ms: 'כֹּתֵב',
    fs: 'כֹּתֶ֫בֶת',
    mp: 'כֹּתְבִים',
    fp: 'כֹּתְבוֹת',
  }),
  paradigm('participle-passive', 'strong', 'קטל', 'kill', GENERAL_GRAMMAR, {
    ms: 'קָטוּל',
    fs: 'קְטוּלָה',
    mp: 'קְטוּלִים',
    fp: 'קְטוּלוֹת',
  }),
  paradigm('participle-passive', 'begadkephat', 'כתב', 'write', GENERAL_GRAMMAR, {
    ms: 'כָּתוּב',
    fs: 'כְּתוּבָה',
    mp: 'כְּתוּבִים',
    fp: 'כְּתוּבוֹת',
  }),
];

// ─── Groups and grids ─────────────────────────────────────────────────────────

/**
 * How the Qal is shown: a finite conjugation on its own, and the two
 * infinitives and the two participles each as one group, since a grammar sets
 * them side by side and a one-form infinitive table would be a table of one.
 * The Grammar Reference's tabs and the paradigm quiz's tabs are these groups,
 * drawn from the same grids, so the two cannot disagree about what a cell is.
 */
export type QalGroup =
  | 'qatal'
  | 'yiqtol'
  | 'wayyiqtol'
  | 'weqatal'
  | 'imperative'
  | 'infinitives'
  | 'participles';

export const QAL_GROUPS: QalGroup[] = [
  'qatal',
  'yiqtol',
  'wayyiqtol',
  'weqatal',
  'imperative',
  'infinitives',
  'participles',
];

/** The groups that are one finite conjugation each. */
export type FiniteConjugation = Exclude<QalGroup, 'infinitives' | 'participles'>;

/** The group a conjugation is shown in. */
export function groupOf(conjugation: Conjugation): QalGroup {
  if (conjugation.startsWith('infinitive-')) return 'infinitives';
  if (conjugation.startsWith('participle-')) return 'participles';
  return conjugation as FiniteConjugation;
}

export const QAL_GROUP_LABELS: Record<QalGroup, string> = {
  qatal: CONJUGATION_LABELS.qatal,
  yiqtol: CONJUGATION_LABELS.yiqtol,
  wayyiqtol: CONJUGATION_LABELS.wayyiqtol,
  weqatal: CONJUGATION_LABELS.weqatal,
  imperative: CONJUGATION_LABELS.imperative,
  infinitives: 'Infinitives',
  participles: 'Participles',
};

/** One cell of a grid: a paradigm's form under one key. */
export interface GridCell {
  paradigm: VerbParadigm;
  key: FormKey;
}

export interface GridColumn {
  /** The verb the column is: its root, class and gloss head the column. */
  paradigm: VerbParadigm;
  /** What sets the column apart when the root does not ("Active"). */
  heading?: string;
}

export interface GridRow {
  /** Short: "3ms", "ms", "Construct". */
  label: string;
  /** Spelled out, for a tooltip or a screen reader. */
  title: string;
  cells: (GridCell | null)[];
}

export interface VerbGrid {
  group: QalGroup;
  columns: GridColumn[];
  rows: GridRow[];
}

/** The non-finite forms come in these classes, in column order. */
const GRID_CLASSES: VerbClass[] = ['strong', 'begadkephat'];

function find(conjugation: Conjugation, verbClass: VerbClass): VerbParadigm | undefined {
  return paradigmsFor(conjugation).find((p) => p.verbClass === verbClass);
}

/**
 * A group's grid. A finite conjugation is every class it has, a row per form;
 * the infinitives are a row each for the construct and the absolute; the
 * participles are the active classes then the passive, a row per gender and
 * number.
 */
export function qalGrid(group: QalGroup): VerbGrid {
  if (group === 'infinitives') {
    const columns = GRID_CLASSES.map((c) => find('infinitive-construct', c)).filter(
      (p): p is VerbParadigm => p !== undefined,
    );
    const row = (label: string, conjugation: Conjugation): GridRow => ({
      label,
      title: `infinitive ${label.toLowerCase()}`,
      cells: columns.map((col) => {
        const paradigm = find(conjugation, col.verbClass);
        return paradigm ? { paradigm, key: 'inf' } : null;
      }),
    });
    return {
      group,
      columns: columns.map((paradigm) => ({ paradigm })),
      rows: [row('Construct', 'infinitive-construct'), row('Absolute', 'infinitive-absolute')],
    };
  }
  if (group === 'participles') {
    const columns: GridColumn[] = (
      [
        ['participle-active', 'Active'],
        ['participle-passive', 'Passive'],
      ] as const
    ).flatMap(([conjugation, heading]) =>
      GRID_CLASSES.map((c) => find(conjugation, c))
        .filter((p): p is VerbParadigm => p !== undefined)
        .map((paradigm) => ({ paradigm, heading })),
    );
    return {
      group,
      columns,
      rows: GN_KEYS.map((key) => ({
        label: key,
        title: formKeyLabel(key),
        cells: columns.map(({ paradigm }) => ({ paradigm, key })),
      })),
    };
  }
  const paradigms = paradigmsFor(group);
  return {
    group,
    columns: paradigms.map((paradigm) => ({ paradigm })),
    rows: CONJUGATION_KEYS[group].map((key) => ({
      label: key,
      title: formKeyLabel(key),
      cells: paradigms.map((paradigm) => (paradigm.forms[key] ? { paradigm, key } : null)),
    })),
  };
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function getParadigm(id: string): VerbParadigm | undefined {
  return verbParadigms.find((p) => p.id === id);
}

/** Every paradigm of one conjugation, in the order the textbook's columns run. */
export function paradigmsFor(conjugation: Conjugation): VerbParadigm[] {
  return verbParadigms.filter((p) => p.conjugation === conjugation);
}

/**
 * A form as a student would type it: the printed form without its stress mark.
 *
 * Grade against this, never against the stored string — the stress mark is a
 * teaching aid on the page, not part of the spelling, and no keyboard mapping
 * produces it.
 */
export function answerForm(form: string): string {
  return stripCantillation(form).normalize('NFC');
}
