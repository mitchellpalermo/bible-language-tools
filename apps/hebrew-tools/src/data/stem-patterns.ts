// The seven stems and their names, transcribed from Garrett & DeRouchie's Table
// 20.1 ("The Stem Names and Patterns with Roots פעל and קטל") — the answer key
// for the quiz's Stems tab.
//
// The table prints each stem's **qatal 3ms** on two roots. The stem names are
// themselves qatal 3ms forms of פעל, "do" (Niphal is נִפְעַל, Piel פִּעֵל); that
// root is no longer the model verb because its guttural middle radical bends the
// pointing, so the textbook teaches the patterns on קטל beside it.
//
// **The textbook is the authority, not the corpus.** Same split as
// `verb-paradigms.ts`: a quiz is marked against the page. The corpus cannot
// witness these either — קטל is barely attested, and the Hiphil and Hophal of
// פעל are not used — so `stem-patterns.test.ts` checks the shape of the table
// (names, unique forms, no stress marks) and that every form is NFC.
//
// **Forms are stored as graded: Table 20.1 prints no stress mark.** Qal קָטַל is
// the same string as `qal-qatal-strong:3ms` in `verb-paradigms.ts`; it keeps a
// card of its own here rather than sharing one, because this tab asks "which
// stem is this" and the paradigm asks "what is the 3ms", and the stems table is
// the only place Qal פָּעַל appears at all.

/** The seven stems in the order the textbook lists them. */
export type StemName = 'qal' | 'niphal' | 'piel' | 'pual' | 'hithpael' | 'hiphil' | 'hophal';

/** `pel` is פעל, the root the stem names are built on; `qtl` is קטל. */
export type StemRoot = 'pel' | 'qtl';

export const STEM_NAMES: StemName[] = [
  'qal',
  'niphal',
  'piel',
  'pual',
  'hithpael',
  'hiphil',
  'hophal',
];

export const STEM_NAME_LABELS: Record<StemName, string> = {
  qal: 'Qal',
  niphal: 'Niphal',
  piel: 'Piel',
  pual: 'Pual',
  hithpael: 'Hithpael',
  hiphil: 'Hiphil',
  hophal: 'Hophal',
};

/** Table 20.1's column order: the root the names come from, then the model verb. */
export const STEM_ROOTS: { id: StemRoot; root: string }[] = [
  { id: 'pel', root: 'פעל' },
  { id: 'qtl', root: 'קטל' },
];

export const STEM_PATTERN_SOURCE = 'Table 20.1';

/** Each stem's qatal 3ms, by root. */
export const STEM_PATTERNS: Record<StemRoot, Record<StemName, string>> = {
  pel: {
    qal: 'פָּעַל',
    niphal: 'נִפְעַל',
    piel: 'פִּעֵל',
    pual: 'פֻּעַל',
    hithpael: 'הִתְפַּעֵל',
    hiphil: 'הִפְעִיל',
    hophal: 'הָפְעַל',
  },
  qtl: {
    qal: 'קָטַל',
    niphal: 'נִקְטַל',
    piel: 'קִטֵּל',
    pual: 'קֻטַּל',
    hithpael: 'הִתְקַטֵּל',
    hiphil: 'הִקְטִיל',
    hophal: 'הָקְטַל',
  },
};

/** A column's id; `<column>:<stem>` is a cell's full id, as `<paradigm>:<pgn>` is for verbs. */
export function stemColumnId(root: StemRoot): string {
  return `stem-pattern-${root}`;
}
