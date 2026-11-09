// Pronominal suffixes on nouns, as quizzable paradigms (ROADMAP Phase 7, issue
// #159) — the answer key for the suffix tables on `/paradigms`.
//
// Three things are load-bearing and none is obvious:
//
// **The authority is general grammar, checked against the corpus — not a
// transcription of the textbook.** The verb paradigms are copied from Garrett &
// DeRouchie because their cells are a course's own printed forms. A suffixed
// noun is different: it is the regular output of a few rules every first-year
// grammar states, so the forms here are those rules applied to conventional
// model nouns, written out in full because a quiz needs an exact answer. Where
// the course's textbook prints a vowel differently, the textbook wins for the
// course; do not paste its table in to settle it. Compare `grammar-nominal.ts`,
// which makes the same choice for the same reason.
//
// **The corpus is a second witness, and here it cannot be a complete one.**
// `pronominal-suffixes.test.ts` looks every form up in the Westminster Leningrad
// Codex, but no noun is suffixed in all ten persons: the Bible addresses
// women, and groups of women, far less than it addresses men. The 2fp and 3fp
// of nearly every noun never occur. Those cells are listed by name in the test
// as `UNATTESTED`, each as a regular form rather than a typo; **a new entry
// there is what a typo looks like**, so swap the model noun before adding one.
//
// **A form is keyed by person-gender-number**, as in `verb-paradigms.ts`, so a
// paradigm renders as person × number and a student's progress on a form stays
// with the form. The PGN is the *suffix's* — the possessor — never the noun's.
//
// The rules the quiz grades against are in `SUFFIX_RULES`, in this file's own
// words, and the test pins each one against the forms.

import type { Pgn } from './verb-paradigms';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Which set of suffixes. Type 1 attaches to a singular noun; Type 2 attaches to
 * a plural noun, and is Type 1 with a yod in front of it (a trace of the plural
 * ending that the noun has shed).
 */
export type SuffixSet = 'type1' | 'type2';

export interface SuffixParadigm {
  /** `suffix-<set>-<noun>` — stable, used in SRS keys. */
  id: string;
  set: SuffixSet;
  /** The model noun in the form the suffixes attach to, pointed. */
  lemma: string;
  /** English gloss, as shown on the select screen. */
  gloss: string;
  /** What the noun is, for the rules that apply to it. */
  shape: 'masculine singular' | 'masculine plural' | 'feminine singular';
  forms: Record<SuffixPgn, string>;
}

/** The suffix owners: every person, gender and number the suffixes distinguish. */
export type SuffixPgn = Extract<
  Pgn,
  '1cs' | '2ms' | '2fs' | '3ms' | '3fs' | '1cp' | '2mp' | '2fp' | '3mp' | '3fp'
>;

// ─── Labels and ordering ──────────────────────────────────────────────────────

/** Singular owners first, then plural, the way a grammar sets suffixes out. */
export const SUFFIX_PGNS: SuffixPgn[] = [
  '1cs',
  '2ms',
  '2fs',
  '3ms',
  '3fs',
  '1cp',
  '2mp',
  '2fp',
  '3mp',
  '3fp',
];

export const SUFFIX_SET_LABELS: Record<SuffixSet, string> = {
  type1: 'Type 1 (on singular nouns)',
  type2: 'Type 2 (on plural nouns)',
};

// ─── Rules ────────────────────────────────────────────────────────────────────

export interface SuffixRule {
  id: string;
  /** Plain English; Hebrew inside it is rendered through `<Prose>`. */
  text: string;
}

/**
 * What a noun does on the way to a suffix. Each is checked against the forms in
 * the test, so a rule that stops being true of the data fails there.
 */
export const SUFFIX_RULES: SuffixRule[] = [
  {
    id: 'type2-yod',
    text: 'Every Type 2 suffix contains a yod: it marks a plural noun, and it is what tells ‘my words’ (דְּבָרַי) from ‘my word’ (דְּבָרִי).',
  },
  {
    id: 'masc-plural',
    text: 'A masculine plural loses its ־ִים before a Type 2 suffix and takes the construct ending ־ֵי: דְּבָרִים becomes דִּבְרֵיהֶם.',
  },
  {
    id: 'fem-singular',
    text: 'A feminine singular ending ־ָה turns back into its older ת before a Type 1 suffix: חָכְמָה becomes חָכְמָתוֹ. Before the heavy suffixes (־כֶם, ־כֶן) the vowel shortens to ־ַת.',
  },
];

// ─── The suffixes alone ───────────────────────────────────────────────────────

/**
 * The suffixes with no noun under them (#186, the ladder's first rung). Each
 * starts with the mark the noun's last letter takes — the ־ִ of ־ִי sits on
 * whatever consonant the stem ends in — so a stem plus one of these is the
 * suffixed form. `pronominal-suffixes.test.ts` checks every noun paradigm in
 * this file is exactly that, cell by cell, which is what guards the cells the
 * corpus cannot.
 */
export const BARE_SUFFIXES: Record<SuffixSet, Record<SuffixPgn, string>> = {
  type1: {
    '1cs': 'ִי',
    '2ms': 'ְךָ',
    '2fs': 'ֵךְ',
    '3ms': 'וֹ',
    '3fs': 'ָהּ',
    '1cp': 'ֵנוּ',
    '2mp': 'ְכֶם',
    '2fp': 'ְכֶן',
    '3mp': 'ָם',
    '3fp': 'ָן',
  },
  type2: {
    '1cs': 'ַי',
    '2ms': 'ֶיךָ',
    '2fs': 'ַיִךְ',
    '3ms': 'ָיו',
    '3fs': 'ֶיהָ',
    '1cp': 'ֵינוּ',
    '2mp': 'ֵיכֶם',
    '2fp': 'ֵיכֶן',
    '3mp': 'ֵיהֶם',
    '3fp': 'ֵיהֶן',
  },
};

/**
 * The heavy suffixes: the ones that take the accent themselves, so a
 * changeable vowel in the stem reduces before them (דְּבַרְכֶם, דִּבְרֵיהֶם).
 * In Type 1 that is ־כֶם and ־כֶן; in Type 2 the third plurals join them.
 */
export const HEAVY_SUFFIXES: Record<SuffixSet, readonly SuffixPgn[]> = {
  type1: ['2mp', '2fp'],
  type2: ['2mp', '2fp', '3mp', '3fp'],
};

// ─── Paradigms ────────────────────────────────────────────────────────────────

export function suffixParadigmId(set: SuffixSet, noun: string): string {
  return `suffix-${set}-${noun}`;
}

export const suffixParadigms: SuffixParadigm[] = [
  // The same noun in both sets, so the two tables differ by the yod and the
  // vowel changes it brings, and by nothing else.
  {
    id: suffixParadigmId('type1', 'dabar'),
    set: 'type1',
    lemma: 'דָּבָר',
    gloss: 'word',
    shape: 'masculine singular',
    forms: {
      '1cs': 'דְּבָרִי',
      '2ms': 'דְּבָרְךָ',
      '2fs': 'דְּבָרֵךְ',
      '3ms': 'דְּבָרוֹ',
      '3fs': 'דְּבָרָהּ',
      '1cp': 'דְּבָרֵנוּ',
      '2mp': 'דְּבַרְכֶם',
      '2fp': 'דְּבַרְכֶן',
      '3mp': 'דְּבָרָם',
      '3fp': 'דְּבָרָן',
    },
  },
  {
    id: suffixParadigmId('type2', 'dabarim'),
    set: 'type2',
    lemma: 'דְּבָרִים',
    gloss: 'words',
    shape: 'masculine plural',
    forms: {
      '1cs': 'דְּבָרַי',
      '2ms': 'דְּבָרֶיךָ',
      '2fs': 'דְּבָרַיִךְ',
      '3ms': 'דְּבָרָיו',
      '3fs': 'דְּבָרֶיהָ',
      '1cp': 'דְּבָרֵינוּ',
      '2mp': 'דִּבְרֵיכֶם',
      '2fp': 'דִּבְרֵיכֶן',
      '3mp': 'דִּבְרֵיהֶם',
      '3fp': 'דִּבְרֵיהֶן',
    },
  },
  {
    id: suffixParadigmId('type1', 'hokmah'),
    set: 'type1',
    lemma: 'חָכְמָה',
    gloss: 'wisdom',
    shape: 'feminine singular',
    forms: {
      '1cs': 'חָכְמָתִי',
      '2ms': 'חָכְמָתְךָ',
      '2fs': 'חָכְמָתֵךְ',
      '3ms': 'חָכְמָתוֹ',
      '3fs': 'חָכְמָתָהּ',
      '1cp': 'חָכְמָתֵנוּ',
      '2mp': 'חָכְמַתְכֶם',
      '2fp': 'חָכְמַתְכֶן',
      '3mp': 'חָכְמָתָם',
      '3fp': 'חָכְמָתָן',
    },
  },
];

/**
 * The model nouns only the suffix ladder uses (#186), one pair per thing a
 * stem can do. Kept out of `suffixParadigms` so the Noun suffixes tab and its
 * summary stay three columns wide; the ladder sets each pair side by side.
 *
 * - סוּס: every vowel unchangeable, so the stem never moves.
 * - מֶלֶךְ: a segholate, whose singular suffixes go on the old one-syllable
 *   stem מַלְכּ־ and whose plural reduces like דְּבָרִים.
 * - עַם: a geminate, whose doubled last letter returns before any suffix.
 */
export const ladderNounParadigms: SuffixParadigm[] = [
  {
    id: suffixParadigmId('type1', 'sus'),
    set: 'type1',
    lemma: 'סוּס',
    gloss: 'horse',
    shape: 'masculine singular',
    forms: {
      '1cs': 'סוּסִי',
      '2ms': 'סוּסְךָ',
      '2fs': 'סוּסֵךְ',
      '3ms': 'סוּסוֹ',
      '3fs': 'סוּסָהּ',
      '1cp': 'סוּסֵנוּ',
      '2mp': 'סוּסְכֶם',
      '2fp': 'סוּסְכֶן',
      '3mp': 'סוּסָם',
      '3fp': 'סוּסָן',
    },
  },
  {
    id: suffixParadigmId('type2', 'susim'),
    set: 'type2',
    lemma: 'סוּסִים',
    gloss: 'horses',
    shape: 'masculine plural',
    forms: {
      '1cs': 'סוּסַי',
      '2ms': 'סוּסֶיךָ',
      '2fs': 'סוּסַיִךְ',
      '3ms': 'סוּסָיו',
      '3fs': 'סוּסֶיהָ',
      '1cp': 'סוּסֵינוּ',
      '2mp': 'סוּסֵיכֶם',
      '2fp': 'סוּסֵיכֶן',
      '3mp': 'סוּסֵיהֶם',
      '3fp': 'סוּסֵיהֶן',
    },
  },
  {
    id: suffixParadigmId('type1', 'melek'),
    set: 'type1',
    lemma: 'מֶלֶךְ',
    gloss: 'king',
    shape: 'masculine singular',
    forms: {
      '1cs': 'מַלְכִּי',
      '2ms': 'מַלְכְּךָ',
      '2fs': 'מַלְכֵּךְ',
      '3ms': 'מַלְכּוֹ',
      '3fs': 'מַלְכָּהּ',
      '1cp': 'מַלְכֵּנוּ',
      '2mp': 'מַלְכְּכֶם',
      '2fp': 'מַלְכְּכֶן',
      '3mp': 'מַלְכָּם',
      '3fp': 'מַלְכָּן',
    },
  },
  {
    id: suffixParadigmId('type2', 'melakim'),
    set: 'type2',
    lemma: 'מְלָכִים',
    gloss: 'kings',
    shape: 'masculine plural',
    forms: {
      '1cs': 'מְלָכַי',
      '2ms': 'מְלָכֶיךָ',
      '2fs': 'מְלָכַיִךְ',
      '3ms': 'מְלָכָיו',
      '3fs': 'מְלָכֶיהָ',
      '1cp': 'מְלָכֵינוּ',
      '2mp': 'מַלְכֵיכֶם',
      '2fp': 'מַלְכֵיכֶן',
      '3mp': 'מַלְכֵיהֶם',
      '3fp': 'מַלְכֵיהֶן',
    },
  },
  {
    id: suffixParadigmId('type1', 'am'),
    set: 'type1',
    lemma: 'עַם',
    gloss: 'people',
    shape: 'masculine singular',
    forms: {
      '1cs': 'עַמִּי',
      '2ms': 'עַמְּךָ',
      '2fs': 'עַמֵּךְ',
      '3ms': 'עַמּוֹ',
      '3fs': 'עַמָּהּ',
      '1cp': 'עַמֵּנוּ',
      '2mp': 'עַמְּכֶם',
      '2fp': 'עַמְּכֶן',
      '3mp': 'עַמָּם',
      '3fp': 'עַמָּן',
    },
  },
  {
    id: suffixParadigmId('type2', 'ammim'),
    set: 'type2',
    lemma: 'עַמִּים',
    gloss: 'peoples',
    shape: 'masculine plural',
    forms: {
      '1cs': 'עַמַּי',
      '2ms': 'עַמֶּיךָ',
      '2fs': 'עַמַּיִךְ',
      '3ms': 'עַמָּיו',
      '3fs': 'עַמֶּיהָ',
      '1cp': 'עַמֵּינוּ',
      '2mp': 'עַמֵּיכֶם',
      '2fp': 'עַמֵּיכֶן',
      '3mp': 'עַמֵּיהֶם',
      '3fp': 'עַמֵּיהֶן',
    },
  },
];

/** Every noun suffix paradigm: the tab's three and the ladder's six. */
export const allSuffixParadigms: SuffixParadigm[] = [...suffixParadigms, ...ladderNounParadigms];

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function getSuffixParadigm(id: string): SuffixParadigm | undefined {
  return allSuffixParadigms.find((p) => p.id === id);
}
