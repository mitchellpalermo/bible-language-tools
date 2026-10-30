// The Accent-Shift Trainer's content (#185): which nouns, which endings, how
// each new form divides into syllables, and the rule that sets each syllable's
// vowel. The drill's mechanics live in `@tools/shared/step-drill`; the
// checking in `../lib/accent-shift.ts`.
//
// Three decisions here are the course's, not general grammar's, and will look
// wrong against another reference:
//
// **A vocal sheva makes a syllable of its own.** Garrett & DeRouchie divide
// דְּ/בָ/רִים, and the course is marked against them. Gesenius says the
// opposite (GKC § 26 m: a consonant with vocal sheva "never has the value of an
// independent syllable"). The drill follows the course, because its third step
// — say which syllable is pretonic and which distant — only has an answer when
// the reduced vowel occupies a syllable.
//
// **"Distant" is every syllable before the pretonic**, the course's word for
// the propretonic and anything further out.
//
// **The rule wording is this app's own**, as for the rest of `/grammar` (see
// the Grammar Reference notes in this app's CLAUDE.md). It follows the
// course's categories without copying its text.
//
// Every form is looked up in the Westminster Leningrad Codex by
// `accent-shift.test.ts`. דְּבַרְכֶם, the textbook-tidy heavy suffix on דָּבָר,
// does not occur, so the singular heavy suffix is drilled on לֵבָב instead.

export type ShiftRuleId =
  | 'syllable-per-consonant'
  | 'vocal-sheva-syllable'
  | 'ending-takes-accent'
  | 'pretonic-position'
  | 'distant-position'
  | 'accented-full'
  | 'closed-unaccented-short'
  | 'open-pretonic-long'
  | 'open-distant-reduces'
  | 'unchangeable-long'
  | 'pretonic-reduces-instead';

export interface ShiftRule {
  name: string;
  /**
   * Plain text; Hebrew runs in it are rendered through `<Prose>`. Divide an
   * example's syllables with a paseq (׀), never a slash: `Prose` splits runs at
   * anything outside the Hebrew block, and a slash would lay the syllables out
   * left to right. Join it with no-break spaces (\u00A0) so it never wraps
   * mid-word on a phone.
   */
  text: string;
  /** Where on `/grammar` the background is taught. */
  href: string;
}

const NOUNS = '/grammar#nouns';
const VOWELS = '/grammar#vowels';

export const SHIFT_RULES: Record<ShiftRuleId, ShiftRule> = {
  'syllable-per-consonant': {
    name: 'One consonant starts each syllable',
    text: 'Every syllable begins with a single consonant. A vowel letter belongs to the syllable of the consonant before it, so סוּסִים divides סוּ\u00A0׀\u00A0סִים.',
    href: VOWELS,
  },
  'vocal-sheva-syllable': {
    name: 'A vocal sheva is its own syllable',
    text: 'In this course a consonant carrying a vocal sheva, or a hateph under a guttural, makes a syllable on its own: דְּ\u00A0׀\u00A0בָ\u00A0׀\u00A0רִים.',
    href: VOWELS,
  },
  'ending-takes-accent': {
    name: 'The ending pulls the accent',
    text: 'A plural ending or a suffix takes the accent off the stem. These forms are accented on the last syllable.',
    href: NOUNS,
  },
  'pretonic-position': {
    name: 'Pretonic is the syllable just before the accent',
    text: 'Count back one syllable from the accented one. That syllable, and only that one, is pretonic.',
    href: NOUNS,
  },
  'distant-position': {
    name: 'Distant is anything further back',
    text: 'Every syllable before the pretonic is distant: the propretonic and any before it.',
    href: NOUNS,
  },
  'accented-full': {
    name: 'The accented syllable keeps a full vowel',
    text: 'An accented syllable has a full vowel, long or short, and never a bare sheva.',
    href: NOUNS,
  },
  'closed-unaccented-short': {
    name: 'A closed syllable without the accent is short',
    text: 'When a syllable ends in a consonant and does not carry the accent, its vowel is short: the qamets of לֵבָב becomes the patah of לְבַבְכֶם.',
    href: NOUNS,
  },
  'open-pretonic-long': {
    name: 'An open pretonic syllable is long',
    text: 'An open syllable right before the accent keeps or takes a long vowel: the qamets of דָּבָר survives in דְּבָרִים.',
    href: NOUNS,
  },
  'open-distant-reduces': {
    name: 'An open distant syllable reduces',
    text: 'Once the accent moves two syllables away, an open syllable reduces to a sheva, or to a hateph under a guttural: דָּבָר becomes דְּבָרִים, חָכָם becomes חֲכָמִים.',
    href: NOUNS,
  },
  'unchangeable-long': {
    name: 'Some long vowels never reduce',
    text: 'A long vowel written with a vowel letter, and the holem of a participle like שֹׁפֵט, stays put however far the accent moves.',
    href: NOUNS,
  },
  'pretonic-reduces-instead': {
    name: 'If the distant vowel holds, the pretonic gives way',
    text: 'When the distant syllable has a vowel that cannot reduce, the pretonic reduces instead: שֹׁפֵט becomes שֹׁפְטִים.',
    href: NOUNS,
  },
};

export type EndingKind = 'plural' | 'light-suffix' | 'heavy-suffix';

export const ENDING_KIND_LABELS: Record<EndingKind, string> = {
  plural: 'Plural ending',
  'light-suffix': 'Light suffix',
  'heavy-suffix': 'Heavy suffix',
};

export interface ShiftSyllable {
  /** The syllable as it is written in the new form. Joined, they are the form. */
  text: string;
  /** The rule that decides this syllable's vowel. */
  rule: ShiftRuleId;
}

export interface ShiftItem {
  /** Stable — it is the SRS card key's suffix. Never rename one. */
  id: string;
  base: string;
  baseGloss: string;
  /** The ending as shown: on a dotted circle when it begins with a point. */
  ending: string;
  endingKind: EndingKind;
  form: string;
  gloss: string;
  syllables: ShiftSyllable[];
  /** Index into `syllables` of the accented one. */
  accent: number;
}

/** Shorthand for the table below; the accent is on the last syllable throughout. */
function item(
  id: string,
  [base, baseGloss]: [string, string],
  [ending, endingKind]: [string, EndingKind],
  [form, gloss]: [string, string],
  syllables: [string, ShiftRuleId][],
): ShiftItem {
  return {
    id,
    base,
    baseGloss,
    ending,
    endingKind,
    form,
    gloss,
    syllables: syllables.map(([text, rule]) => ({ text, rule })),
    accent: syllables.length - 1,
  };
}

/**
 * The item pool, in teaching order: the Grammar page's model nouns first
 * (דָּבָר, זָקֵן, צְדָקָה), then the exceptions the rules name.
 */
export const SHIFT_ITEMS: ShiftItem[] = [
  item(
    'davar-pl',
    ['דָּבָר', 'word'],
    ['◌ִים', 'plural'],
    ['דְּבָרִים', 'words'],
    [
      ['דְּ', 'open-distant-reduces'],
      ['בָ', 'open-pretonic-long'],
      ['רִים', 'accented-full'],
    ],
  ),
  item(
    'davar-1cs',
    ['דָּבָר', 'word'],
    ['◌ִי', 'light-suffix'],
    ['דְּבָרִי', 'my word'],
    [
      ['דְּ', 'open-distant-reduces'],
      ['בָ', 'open-pretonic-long'],
      ['רִי', 'accented-full'],
    ],
  ),
  item(
    'devarim-2mp',
    ['דְּבָרִים', 'words'],
    ['◌ֵיכֶם', 'heavy-suffix'],
    ['דִּבְרֵיכֶם', 'your words'],
    [
      ['דִּבְ', 'closed-unaccented-short'],
      ['רֵי', 'open-pretonic-long'],
      ['כֶם', 'accented-full'],
    ],
  ),
  item(
    'zaqen-pl',
    ['זָקֵן', 'elder'],
    ['◌ִים', 'plural'],
    ['זְקֵנִים', 'elders'],
    [
      ['זְ', 'open-distant-reduces'],
      ['קֵ', 'open-pretonic-long'],
      ['נִים', 'accented-full'],
    ],
  ),
  item(
    'zeqenim-3ms',
    ['זְקֵנִים', 'elders'],
    ['◌ָיו', 'light-suffix'],
    ['זְקֵנָיו', 'his elders'],
    [
      ['זְ', 'open-distant-reduces'],
      ['קֵ', 'open-pretonic-long'],
      ['נָיו', 'accented-full'],
    ],
  ),
  item(
    'zeqenim-2mp',
    ['זְקֵנִים', 'elders'],
    ['◌ֵיכֶם', 'heavy-suffix'],
    ['זִקְנֵיכֶם', 'your elders'],
    [
      ['זִקְ', 'closed-unaccented-short'],
      ['נֵי', 'open-pretonic-long'],
      ['כֶם', 'accented-full'],
    ],
  ),
  item(
    'tsedaqah-pl',
    ['צְדָקָה', 'righteousness'],
    ['וֹת', 'plural'],
    ['צְדָקוֹת', 'righteous acts'],
    [
      ['צְ', 'open-distant-reduces'],
      ['דָ', 'open-pretonic-long'],
      ['קוֹת', 'accented-full'],
    ],
  ),
  item(
    'tsedaqah-1cs',
    ['צְדָקָה', 'righteousness'],
    ['◌ִי', 'light-suffix'],
    ['צִדְקָתִי', 'my righteousness'],
    [
      ['צִדְ', 'closed-unaccented-short'],
      ['קָ', 'open-pretonic-long'],
      ['תִי', 'accented-full'],
    ],
  ),
  item(
    'levav-1cs',
    ['לֵבָב', 'heart'],
    ['◌ִי', 'light-suffix'],
    ['לְבָבִי', 'my heart'],
    [
      ['לְ', 'open-distant-reduces'],
      ['בָ', 'open-pretonic-long'],
      ['בִי', 'accented-full'],
    ],
  ),
  item(
    'levav-2mp',
    ['לֵבָב', 'heart'],
    ['כֶם', 'heavy-suffix'],
    ['לְבַבְכֶם', 'your heart'],
    [
      ['לְ', 'open-distant-reduces'],
      ['בַבְ', 'closed-unaccented-short'],
      ['כֶם', 'accented-full'],
    ],
  ),
  item(
    'hakham-pl',
    ['חָכָם', 'wise man'],
    ['◌ִים', 'plural'],
    ['חֲכָמִים', 'wise men'],
    [
      ['חֲ', 'open-distant-reduces'],
      ['כָ', 'open-pretonic-long'],
      ['מִים', 'accented-full'],
    ],
  ),
  item(
    'adamah-3ms',
    ['אֲדָמָה', 'ground'],
    ['וֹ', 'light-suffix'],
    ['אַדְמָתוֹ', 'his ground'],
    [
      ['אַדְ', 'closed-unaccented-short'],
      ['מָ', 'open-pretonic-long'],
      ['תוֹ', 'accented-full'],
    ],
  ),
  item(
    'shofet-pl',
    ['שֹׁפֵט', 'judge'],
    ['◌ִים', 'plural'],
    ['שֹׁפְטִים', 'judges'],
    [
      ['שֹׁ', 'unchangeable-long'],
      ['פְ', 'pretonic-reduces-instead'],
      ['טִים', 'accented-full'],
    ],
  ),
  item(
    'sus-pl',
    ['סוּס', 'horse'],
    ['◌ִים', 'plural'],
    ['סוּסִים', 'horses'],
    [
      ['סוּ', 'unchangeable-long'],
      ['סִים', 'accented-full'],
    ],
  ),
];

export type SyllablePosition = 'accented' | 'pretonic' | 'distant';

export const POSITION_LABELS: Record<Exclude<SyllablePosition, 'accented'>, string> = {
  pretonic: 'Pretonic',
  distant: 'Distant',
};

/** Where a syllable sits relative to the accent. Nothing here comes after it. */
export function positionOf(index: number, accent: number): SyllablePosition {
  if (index === accent) return 'accented';
  return index === accent - 1 ? 'pretonic' : 'distant';
}
