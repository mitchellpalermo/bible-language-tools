// Verb paradigms, transcribed from Garrett & DeRouchie, *A Modern Grammar for
// Biblical Hebrew* — the answer key for the paradigm quiz (ROADMAP Phase 7,
// issue #80) and, later, the source the Grammar Reference (Phase 6) renders.
//
// Three things are load-bearing and none is obvious:
//
// **The textbook is the authority, not the corpus.** These are hand-entered
// from the tables named in each paradigm's `source`, for the same reason the
// flashcard glosses are Garrett's: a quiz is marked against the page. They
// cannot be generated from OSHB in any case — קטל, the model strong verb, is
// barely attested in the Hebrew Bible, and a paradigm cell is the *regular*
// form whether or not Scripture happens to use it. `verb-paradigms.test.ts`
// cross-checks the attested verbs against the corpus when it is present, which
// catches transcription slips without making the corpus the source.
//
// **A form is keyed by person-gender-number, never by row and column.** The
// textbook prints the same paradigm two ways — one verb as person × number
// (Table 10.8), and several verb classes side by side as PGN × class (Tables
// 9.6, 10.7). Keying by PGN is what lets one paradigm render in either layout
// and keeps a student's progress on a form attached to the form.
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

export type Stem = 'qal';

export type Conjugation = 'qatal' | 'yiqtol' | 'wayyiqtol';

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
  /** Where in the textbook this was transcribed from. */
  source: string;
  /** Absent keys are forms the conjugation does not have (no 3cp in the yiqtol). */
  forms: Partial<Record<Pgn, string>>;
}

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

export const CONJUGATION_PGNS: Record<Conjugation, Pgn[]> = {
  qatal: QATAL_PGNS,
  yiqtol: PREFIXED_PGNS,
  wayyiqtol: PREFIXED_PGNS,
};

export const CONJUGATION_LABELS: Record<Conjugation, string> = {
  qatal: 'Qatal (Perfect)',
  yiqtol: 'Yiqtol (Imperfect)',
  wayyiqtol: 'Wayyiqtol',
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
  forms: Partial<Record<Pgn, string>>,
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
];

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
