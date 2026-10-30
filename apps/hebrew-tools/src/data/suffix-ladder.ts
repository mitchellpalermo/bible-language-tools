// The pronominal suffix ladder (#186): eight tables in order of difficulty, on
// the Paradigms page. Which rungs are open is `@tools/shared/ladder`'s job;
// this file is only what each rung asks for.
//
// Three things are load-bearing:
//
// **Every rung is one table, PGN down the side.** The issue's rungs mostly pair
// a singular with its plural (סוּס and סוּסִים); set side by side they are one
// table, so "two clean writes of the rung" means one thing and not "two of each".
//
// **A column's id is the paradigm's id, so a cell's id is the form's.** The
// דָּבָר column on rung 3 and the דָּבָר table in the Noun suffixes tab share
// `suffix-type1-dabar:3ms`, and with it one SRS card. Rung 8's suffix columns
// reuse rung 1's ids for the same reason.
//
// **The authority is general grammar, checked two ways.** Nouns come from
// `pronominal-suffixes.ts`, where every form is pinned as stem + bare suffix
// and looked up in the WLC. The prepositions and pronouns here are looked up in
// `suffix-ladder.test.ts`. All of it needs a Hebrew instructor's review before
// release (#186).

import { personalPronouns } from './grammar-pronominal';
import {
  BARE_SUFFIXES,
  getSuffixParadigm,
  SUFFIX_PGNS,
  SUFFIX_RULES,
  type SuffixParadigm,
  type SuffixPgn,
} from './pronominal-suffixes';

export interface LadderColumn {
  /** Prefix of every cell id in the column: `<id>:<pgn>`. */
  id: string;
  /** The column header. Hebrew in it is rendered through `<Prose>`. */
  label: string;
  forms: Record<SuffixPgn, string>;
}

export interface LadderRung {
  /** Stable: ladder progress is stored under it. */
  id: string;
  title: string;
  /** What this rung adds to the one below. */
  detail: string;
  columns: LadderColumn[];
  /** Shown under the table. Hebrew inside is rendered through `<Prose>`. */
  notes: string[];
}

// ─── Columns ──────────────────────────────────────────────────────────────────

export const BARE_COLUMNS: Record<'type1' | 'type2', LadderColumn> = {
  type1: { id: 'suffix-bare-type1', label: 'Type 1', forms: BARE_SUFFIXES.type1 },
  type2: { id: 'suffix-bare-type2', label: 'Type 2', forms: BARE_SUFFIXES.type2 },
};

/**
 * One preposition from each set. לְ is the commonest Type 1 preposition, אֶל
 * the commonest Type 2 one; see `prepositionSuffixRules` in
 * `grammar-pronominal.ts` for the rest.
 */
export const PREPOSITION_COLUMNS: LadderColumn[] = [
  {
    id: 'suffix-prep-le',
    label: 'לְ (Type 1)',
    forms: {
      '1cs': 'לִי',
      '2ms': 'לְךָ',
      '2fs': 'לָךְ',
      '3ms': 'לוֹ',
      '3fs': 'לָהּ',
      '1cp': 'לָנוּ',
      '2mp': 'לָכֶם',
      '2fp': 'לָכֶן',
      '3mp': 'לָהֶם',
      '3fp': 'לָהֶן',
    },
  },
  {
    id: 'suffix-prep-el',
    label: 'אֶל (Type 2)',
    forms: {
      '1cs': 'אֵלַי',
      '2ms': 'אֵלֶיךָ',
      '2fs': 'אֵלַיִךְ',
      '3ms': 'אֵלָיו',
      '3fs': 'אֵלֶיהָ',
      '1cp': 'אֵלֵינוּ',
      '2mp': 'אֲלֵיכֶם',
      '2fp': 'אֲלֵיכֶן',
      '3mp': 'אֲלֵיהֶם',
      '3fp': 'אֲלֵיהֶן',
    },
  },
];

/** The everyday form of each pronoun: the alternates are left out. */
export const PRONOUN_COLUMN: LadderColumn = {
  id: 'pronoun-independent',
  label: 'Pronoun',
  forms: Object.fromEntries(
    SUFFIX_PGNS.map((pgn) => [pgn, personalPronouns.find((p) => p.pgn === pgn)?.hebrew ?? '']),
  ) as Record<SuffixPgn, string>,
};

function nounColumn(id: string): LadderColumn {
  const p = getSuffixParadigm(id) as SuffixParadigm;
  return { id: p.id, label: p.lemma, forms: p.forms };
}

function rule(id: string): string {
  return SUFFIX_RULES.find((r) => r.id === id)?.text ?? '';
}

// ─── Rungs ────────────────────────────────────────────────────────────────────

export const ladderRungs: LadderRung[] = [
  {
    id: 'suffixes',
    title: 'The suffixes alone',
    detail: 'Type 1 and Type 2, with no noun under them',
    columns: [BARE_COLUMNS.type1, BARE_COLUMNS.type2],
    notes: [
      'Each suffix begins with the mark the noun’s last letter takes: ־ִי is a hireq under that letter, then a yod.',
      rule('type2-yod'),
    ],
  },
  {
    id: 'sus',
    title: 'סוּס and סוּסִים',
    detail: 'A stem that never changes',
    columns: [nounColumn('suffix-type1-sus'), nounColumn('suffix-type2-susim')],
    notes: [
      'Every vowel in סוּס is unchangeable, so each form is the stem with the suffix added: סוּסִי, סוּסֵיהֶם.',
    ],
  },
  {
    id: 'dabar',
    title: 'דָּבָר and דְּבָרִים',
    detail: 'A stem that reduces',
    columns: [nounColumn('suffix-type1-dabar'), nounColumn('suffix-type2-dabarim')],
    notes: [
      'The accent moves onto the suffix, and the distant qamets of דָּבָר reduces to a vocal sheva: דְּבָרִי.',
      'Before ־כֶם and ־כֶן the second qamets is left in a closed syllable and shortens to patah: דְּבַרְכֶם.',
      rule('masc-plural'),
    ],
  },
  {
    id: 'feminine',
    title: 'חָכְמָה',
    detail: 'A feminine noun in ־ָה',
    columns: [nounColumn('suffix-type1-hokmah')],
    notes: [rule('fem-singular')],
  },
  {
    id: 'segholate',
    title: 'מֶלֶךְ and מְלָכִים',
    detail: 'A segholate',
    columns: [nounColumn('suffix-type1-melek'), nounColumn('suffix-type2-melakim')],
    notes: [
      'A segholate takes its singular suffixes on an older one-syllable stem: מֶלֶךְ is מַלְכּ־, as in מַלְכִּי. The כ has a dagesh lene after the closed syllable.',
      'The plural reduces like דְּבָרִים: מְלָכֶיהָ, then מַלְכֵיהֶם before a heavy suffix.',
    ],
  },
  {
    id: 'geminate',
    title: 'עַם and עַמִּים',
    detail: 'A geminate',
    columns: [nounColumn('suffix-type1-am'), nounColumn('suffix-type2-ammim')],
    notes: [
      'The root of עַם ends in a doubled letter. The doubling is lost at the end of a word and comes back, as a dagesh, before any suffix: עַמִּי, עַמָּיו.',
    ],
  },
  {
    id: 'prepositions',
    title: 'לְ and אֶל',
    detail: 'Prepositions with Type 1 and Type 2 suffixes',
    columns: PREPOSITION_COLUMNS,
    notes: [
      'לְ takes the Type 1 suffixes; אֶל takes the Type 2 set, connecting yod and all.',
      'לְ has its own forms in places: the 2fs is לָךְ, and “them” is לָהֶם, לָהֶן.',
    ],
  },
  {
    id: 'pronouns',
    title: 'Pronouns and suffixes',
    detail: 'Each independent pronoun beside its two suffixes',
    columns: [PRONOUN_COLUMN, BARE_COLUMNS.type1, BARE_COLUMNS.type2],
    notes: [
      'Where a pronoun has a longer form (אָנֹכִי, הֵמָּה), the table asks for the everyday one. The 2fp is the full אַתֵּנָה.',
    ],
  },
];

export const LADDER_RUNG_IDS: string[] = ladderRungs.map((r) => r.id);
