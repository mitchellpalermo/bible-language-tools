// Grammar Reference data — pronouns and pronominal suffixes (ROADMAP Phase
// 6c, issue #152).
//
// Three things are load-bearing and none is obvious:
//
// **This is general grammar, not a transcription of the textbook.** Like the
// nominal section, the rules here are the ones every first-year grammar
// states, in this file's own words. Nothing here is quizzed, so nothing is
// copied from Garrett & DeRouchie. The section uses the course's Type 1 /
// Type 2 names for the two suffix sets, since that is what the students
// reading it call them.
//
// **Every Hebrew form is checked against the Westminster Leningrad Codex.**
// `grammar-pronominal.test.ts` looks each form up in the corpus where
// `pnpm build:data` has been run. The suffix paradigms are full paradigms on
// model nouns chosen so that nearly every cell occurs: שֵׁם for Type 1
// (8 of 10 cells), בָּנִים for Type 2 (9 of 10). The three cells the Bible
// never happens to use are regular formations listed by name in UNATTESTED.
// A *new* entry there is what a typo looks like.
//
// **The מָה spellings are corpus findings, not a remembered rule.** Counting
// the text: מָה stands before א, מַה before most other consonants, מֶה before
// ע and ח. The examples below are the common cases of each.

import type { Example, FormRule } from './grammar-nominal';
import { type Pgn, pgnLabel } from './verb-paradigms';

// ─── Personal pronouns ────────────────────────────────────────────────────────

export interface PronounEntry {
  /** e.g. '1cs' — the row label, with the full label on hover. */
  pgn: Pgn | '1cs-alt' | '3fp-alt';
  hebrew: string;
  gloss: string;
}

/**
 * The independent personal pronouns. אֲנִי and הֵנָּה have longer alternates;
 * the 2fp is אַתֵּנָה — the short אַתֵּן occurs only bound to what precedes it
 * (וְאַתֵּן).
 */
export const personalPronouns: PronounEntry[] = [
  { pgn: '1cs', hebrew: 'אֲנִי', gloss: 'I' },
  { pgn: '1cs-alt', hebrew: 'אָנֹכִי', gloss: 'I' },
  { pgn: '2ms', hebrew: 'אַתָּה', gloss: 'you' },
  { pgn: '2fs', hebrew: 'אַתְּ', gloss: 'you' },
  { pgn: '3ms', hebrew: 'הוּא', gloss: 'he' },
  { pgn: '3fs', hebrew: 'הִיא', gloss: 'she' },
  { pgn: '1cp', hebrew: 'אֲנַחְנוּ', gloss: 'we' },
  { pgn: '2mp', hebrew: 'אַתֶּם', gloss: 'you' },
  { pgn: '2fp', hebrew: 'אַתֵּנָה', gloss: 'you' },
  { pgn: '3mp', hebrew: 'הֵם', gloss: 'they' },
  { pgn: '3fp', hebrew: 'הֵנָּה', gloss: 'they' },
  { pgn: '3fp-alt', hebrew: 'הֵמָּה', gloss: 'they' },
];

export function pronounPgnLabel(pgn: PronounEntry['pgn']): string {
  if (pgn === '1cs-alt') return `${pgnLabel('1cs')} (alternate)`;
  if (pgn === '3fp-alt') return `${pgnLabel('3fp')} (alternate)`;
  return pgnLabel(pgn);
}

// ─── Demonstratives ───────────────────────────────────────────────────────────

export interface DemonstrativeEntry {
  distance: 'near' | 'far';
  number: 'singular' | 'plural';
  /** null for the plural, which does not mark gender. */
  gender: 'm' | 'f' | null;
  hebrew: string;
  gloss: string;
}

/** Near and far. The far demonstratives are the personal pronouns. */
export const demonstratives: DemonstrativeEntry[] = [
  { distance: 'near', number: 'singular', gender: 'm', hebrew: 'זֶה', gloss: 'this' },
  { distance: 'near', number: 'singular', gender: 'f', hebrew: 'זֹאת', gloss: 'this' },
  { distance: 'near', number: 'plural', gender: null, hebrew: 'אֵלֶּה', gloss: 'these' },
  { distance: 'far', number: 'singular', gender: 'm', hebrew: 'הוּא', gloss: 'that' },
  { distance: 'far', number: 'singular', gender: 'f', hebrew: 'הִיא', gloss: 'that' },
  { distance: 'far', number: 'plural', gender: null, hebrew: 'הֵם', gloss: 'those' },
  { distance: 'far', number: 'plural', gender: null, hebrew: 'הֵנָּה', gloss: 'those' },
];

// ─── Interrogatives and the relative ──────────────────────────────────────────

/** מִי never changes. מָה is spelled three ways — see the file header. */
export const interrogativeRules: FormRule[] = [
  {
    id: 'mi',
    when: '“Who?” — always מִי',
    form: 'מִי',
    note: 'The one interrogative that never changes its shape.',
    examples: [{ hebrew: 'מִי־אֵלֶּה', gloss: 'who are these?' }],
  },
  {
    id: 'mah-aleph',
    when: '“What?” before א',
    form: 'מָה',
    note: 'The full form, with its qamets, before aleph.',
    examples: [{ hebrew: 'מָה־אֵלֶּה', gloss: 'what are these?' }],
  },
  {
    id: 'mah-most',
    when: 'Before most other consonants',
    form: 'מַה־',
    note: 'Joined to the next word by a maqqef, the qamets shortens to a patah.',
    examples: [
      { hebrew: 'מַה־זֶּה', gloss: 'what is this?' },
      { hebrew: 'מַה־לָּךְ', gloss: 'what is it to you?' },
    ],
  },
  {
    id: 'meh-guttural',
    when: 'Before ע and ח',
    form: 'מֶה',
    note: 'Before these gutturals the vowel is a segol.',
    examples: [{ hebrew: 'מֶה עָשִׂיתָ', gloss: 'what have you done?' }],
  },
];

/** The relative pronoun, free-standing and prefixed. */
export const relativePronouns: Example[] = [
  { hebrew: 'אֲשֶׁר', gloss: 'who, whom, which, that' },
  { hebrew: 'שֶׁ־', gloss: 'that, which — the prefixed form' },
];

export const pronounNotes: string[] = [
  'אָנֹכִי is the longer 1cs form, somewhat more emphatic; אֲנִי is the everyday one.',
  'The far demonstratives do double duty as the personal pronouns: הוּא is both “he” and “that”.',
];

// ─── Pronominal suffixes ──────────────────────────────────────────────────────

export type SuffixPgn =
  | '1cs'
  | '2ms'
  | '2fs'
  | '3ms'
  | '3fs'
  | '1cp'
  | '2mp'
  | '2fp'
  | '3mp'
  | '3fp';

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

/** For glosses: שְׁמִי is “my name”, בָּנָיו “his sons”. */
export const POSSESSIVE_EN: Record<SuffixPgn, string> = {
  '1cs': 'my',
  '2ms': 'your',
  '2fs': 'your',
  '3ms': 'his',
  '3fs': 'her',
  '1cp': 'our',
  '2mp': 'your',
  '2fp': 'your',
  '3mp': 'their',
  '3fp': 'their',
};

export interface SuffixParadigm {
  id: string;
  /** 'type1' — on a singular noun; 'type2' — on a plural noun. */
  suffixType: 'type1' | 'type2';
  title: string;
  note: string;
  /** The English noun the glosses are built on. */
  modelGloss: string;
  forms: Record<SuffixPgn, string>;
}

/**
 * The two suffix sets, each as a full paradigm on a model noun the corpus
 * attests nearly throughout. Type 1 (שֵׁם, “name”) and Type 2 (בָּנִים,
 * “sons”) differ by the connecting yod after the plural stem.
 */
export const suffixParadigms: SuffixParadigm[] = [
  {
    id: 'type1-shem',
    suffixType: 'type1',
    title: 'Type 1 — on a singular noun',
    note: 'The suffix joins the singular stem. The 2fs and 1cp suffixes bring their own full vowel, so the stem keeps its sheva (שְׁמֵךְ, שְׁמֵנוּ). In the 2ms, 2mp and 2fp the suffix opens with a sheva, so the stem takes a hireq instead (שִׁמְךָ, שִׁמְכֶם).',
    modelGloss: 'name',
    forms: {
      '1cs': 'שְׁמִי',
      '2ms': 'שִׁמְךָ',
      '2fs': 'שְׁמֵךְ',
      '3ms': 'שְׁמוֹ',
      '3fs': 'שְׁמָהּ',
      '1cp': 'שְׁמֵנוּ',
      '2mp': 'שִׁמְכֶם',
      '2fp': 'שִׁמְכֶן',
      '3mp': 'שְׁמָם',
      '3fp': 'שְׁמָן',
    },
  },
  {
    id: 'type2-banim',
    suffixType: 'type2',
    title: 'Type 2 — on a plural noun',
    note: 'The plural stem keeps its yod before every suffix, as in בָּנֶיךָ and בָּנָיו. The 1cs is the exception: the final yod of בָּנַי is the suffix itself, with no separate connecting yod before it.',
    modelGloss: 'sons',
    forms: {
      '1cs': 'בָּנַי',
      '2ms': 'בָּנֶיךָ',
      '2fs': 'בָּנַיִךְ',
      '3ms': 'בָּנָיו',
      '3fs': 'בָּנֶיהָ',
      '1cp': 'בָּנֵינוּ',
      '2mp': 'בְּנֵיכֶם',
      '2fp': 'בְּנֵיכֶן',
      '3mp': 'בְּנֵיהֶם',
      '3fp': 'בְּנֵיהֶן',
    },
  },
];

/** A feminine noun in ־ָה takes a tav before a suffix, pointed ־ָת or ־ַת by the usual vowel changes. */
export const feminineTavRule: FormRule = {
  id: 'feminine-tav',
  when: 'Feminine ־ָה before a suffix',
  form: '־ָת / ־ַת',
  note: 'The feminine ending changes before a suffix, and its vowel is qamets or patah as the ordinary vowel changes dictate. In תּוֹרָה the qamets survives: תּוֹרָתִי “my law”, תּוֹרָתְךָ “your law”. The suffixes then join as Type 1.',
  examples: [
    { from: 'תּוֹרָה', hebrew: 'תּוֹרָתִי', gloss: 'my law' },
    { from: 'תּוֹרָה', hebrew: 'תּוֹרָתְךָ', gloss: 'your law' },
  ],
};

/**
 * Suffixes on prepositions. אֶל, עַל and תַּחַת take the Type 2 set, with the
 * connecting yod; the rest take Type 1. כְּ and מִן do not take suffixes
 * directly and expand instead.
 */
export const prepositionSuffixRules: FormRule[] = [
  {
    id: 'plural-set',
    when: 'אֶל, עַל, תַּחַת — the Type 2 set',
    form: 'with ־ֵי־',
    note: 'These prepositions take the plural-noun suffixes, connecting yod and all.',
    examples: [
      { hebrew: 'אֵלַי', gloss: 'to me' },
      { hebrew: 'אֵלֶיךָ', gloss: 'to you' },
      { hebrew: 'אֵלָיו', gloss: 'to him' },
      { hebrew: 'אֲלֵיכֶם', gloss: 'to you (pl.)' },
      { hebrew: 'עָלַי', gloss: 'on me' },
      { hebrew: 'עָלֶיךָ', gloss: 'on you' },
      { hebrew: 'עָלָיו', gloss: 'on him' },
      { hebrew: 'עֲלֵיכֶם', gloss: 'on you (pl.)' },
      { hebrew: 'תַּחְתֶּיךָ', gloss: 'under you' },
      { hebrew: 'תַּחְתָּיו', gloss: 'under him' },
    ],
  },
  {
    id: 'singular-set',
    when: 'בְּ, לְ, עִם, אֵת — the Type 1 set',
    form: 'as on a singular noun',
    note: 'No connecting yod. אֵת “with” and the object marker אֵת are different words that share a spelling, and their suffixed forms part ways: אִתִּי is “with me”, אֹתִי is “me”.',
    examples: [
      { hebrew: 'בִּי', gloss: 'in me' },
      { hebrew: 'בְּךָ', gloss: 'in you' },
      { hebrew: 'בּוֹ', gloss: 'in him' },
      { hebrew: 'בָּהֶם', gloss: 'in them' },
      { hebrew: 'לִי', gloss: 'to me' },
      { hebrew: 'לְךָ', gloss: 'to you' },
      { hebrew: 'לוֹ', gloss: 'to him' },
      { hebrew: 'לָהֶם', gloss: 'to them' },
      { hebrew: 'עִמִּי', gloss: 'with me' },
      { hebrew: 'עִמְּךָ', gloss: 'with you' },
      { hebrew: 'עִמּוֹ', gloss: 'with him' },
      { hebrew: 'אִתִּי', gloss: 'with me' },
      { hebrew: 'אִתְּךָ', gloss: 'with you' },
      { hebrew: 'אִתּוֹ', gloss: 'with him' },
    ],
  },
  {
    id: 'kaf-expands',
    when: 'כְּ → כָּמוֹ',
    form: 'כָּמוֹ־',
    note: 'כְּ never takes a suffix directly; it expands to כָּמוֹ first.',
    examples: [
      { hebrew: 'כָּמוֹנִי', gloss: 'like me' },
      { hebrew: 'כָּמוֹךָ', gloss: 'like you' },
      { hebrew: 'כָּמֹהוּ', gloss: 'like him' },
      { hebrew: 'כָּמוֹנוּ', gloss: 'like us' },
    ],
  },
  {
    id: 'min-expands',
    when: 'מִן → מִמֶּנִּי',
    form: 'מִמֶּנִּי',
    note: 'מִן assimilates and expands before suffixes. מִמֶּנּוּ is both “from him” and “from us”.',
    examples: [
      { hebrew: 'מִמֶּנִּי', gloss: 'from me' },
      { hebrew: 'מִמְּךָ', gloss: 'from you' },
      { hebrew: 'מִמֶּנּוּ', gloss: 'from him / from us' },
      { hebrew: 'מֵהֶם', gloss: 'from them' },
    ],
  },
];

export const suffixNotes: string[] = [
  'בְּנִי is “my son” and בָּנַי is “my sons” — the two differ in their vowels alone.',
  'מִמֶּנּוּ does double duty: “from him” and “from us” are the same form.',
];
