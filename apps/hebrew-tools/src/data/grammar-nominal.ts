// Grammar Reference data — nouns, the article and the prepositions (ROADMAP
// Phase 6b, issue #79).
//
// Three things are load-bearing and none is obvious:
//
// **This is general grammar, not a transcription of the textbook.** The verb
// paradigms in `verb-paradigms.ts` are copied from Garrett & DeRouchie's tables
// because a quiz is marked against them. Nothing here is quizzed, so nothing
// here is copied: the rules are the ones every first-year grammar states, in
// this file's own words, on the conventional model nouns. Where the course's
// textbook words a rule differently, the textbook wins for the course — but do
// not paste its tables in to settle it.
//
// **Every Hebrew form is checked against the Westminster Leningrad Codex.**
// Pointed Hebrew typed from memory goes wrong by one vowel. `grammar-nominal
// .test.ts` looks each form up in the corpus where `pnpm build:data` has been
// run, and the handful the Bible never happens to use are listed there by name.
// A form that newly fails that check is a typo until shown otherwise.
//
// **Stress is marked only where it is the point.** Segolates and duals are
// stressed on the syllable before the last, and that is what defines them, so
// those forms carry the same stress mark the verb tables use. Elsewhere it is
// left off; nobody needs telling that דָּבָר is stressed at the end.

// ─── Nouns ────────────────────────────────────────────────────────────────────

export type NounGender = 'm' | 'f';
export type NounNumber = 'singular' | 'plural' | 'dual';
export type NounState = 'absolute' | 'construct';

export const NOUN_GENDER_LABELS: Record<NounGender, string> = {
  m: 'Masculine',
  f: 'Feminine',
};

export const NOUN_NUMBER_LABELS: Record<NounNumber, string> = {
  singular: 'Singular',
  plural: 'Plural',
  dual: 'Dual',
};

export const NOUN_STATE_LABELS: Record<NounState, string> = {
  absolute: 'Absolute',
  construct: 'Construct',
};

export const NOUN_NUMBERS: NounNumber[] = ['singular', 'plural', 'dual'];
export const NOUN_STATES: NounState[] = ['absolute', 'construct'];

/**
 * What a noun adds for each number and state. An empty string is "no ending",
 * which is an answer and not a gap; the endings are shown on a dotted circle
 * because a vowel point needs something to sit under.
 */
export const NOUN_ENDINGS: Record<NounGender, Record<NounNumber, Record<NounState, string>>> = {
  m: {
    singular: { absolute: '', construct: '' },
    plural: { absolute: 'ִים', construct: 'ֵי' },
    dual: { absolute: 'ַ֫יִם', construct: 'ֵי' },
  },
  f: {
    singular: { absolute: 'ָה', construct: 'ַת' },
    plural: { absolute: 'וֹת', construct: 'וֹת' },
    dual: { absolute: 'ָתַ֫יִם', construct: 'ְתֵי' },
  },
};

/** A cell of a noun table: number and state together. */
export type NounFormKey = 'sgAbs' | 'sgCstr' | 'plAbs' | 'plCstr' | 'duAbs' | 'duCstr';

export const NOUN_FORM_LABELS: Record<NounFormKey, string> = {
  sgAbs: 'singular absolute',
  sgCstr: 'singular construct',
  plAbs: 'plural absolute',
  plCstr: 'plural construct',
  duAbs: 'dual absolute',
  duCstr: 'dual construct',
};

export interface NounParadigm {
  /** Stable id — the lemma, romanized. */
  id: string;
  /** The singular absolute, unaccented: what a lexicon lists it under. */
  lemma: string;
  gloss: string;
  gender: NounGender;
  /** Absent keys are forms the noun does not have, or that the table does not show. */
  forms: Partial<Record<NounFormKey, string>>;
}

export interface NounGroup {
  id: string;
  title: string;
  /** What the group is there to show. */
  note: string;
  /** The columns, in order. */
  columns: NounFormKey[];
  nouns: NounParadigm[];
}

const FULL: NounFormKey[] = ['sgAbs', 'sgCstr', 'plAbs', 'plCstr'];

export const nounGroups: NounGroup[] = [
  {
    id: 'unchanging',
    title: 'Endings on an unchanging stem',
    note: 'A long vowel written with a vowel letter does not reduce, so nothing moves but the ending. The masculine singular construct looks exactly like the absolute.',
    columns: FULL,
    nouns: [
      {
        id: 'sus',
        lemma: 'סוּס',
        gloss: 'horse',
        gender: 'm',
        forms: { sgAbs: 'סוּס', sgCstr: 'סוּס', plAbs: 'סוּסִים', plCstr: 'סוּסֵי' },
      },
      {
        id: 'susah',
        lemma: 'סוּסָה',
        gloss: 'mare',
        gender: 'f',
        forms: { sgAbs: 'סוּסָה', sgCstr: 'סוּסַת', plAbs: 'סוּסוֹת', plCstr: 'סוּסוֹת' },
      },
      {
        id: 'torah',
        lemma: 'תּוֹרָה',
        gloss: 'law, instruction',
        gender: 'f',
        forms: { sgAbs: 'תּוֹרָה', sgCstr: 'תּוֹרַת', plAbs: 'תּוֹרוֹת', plCstr: 'תּוֹרוֹת' },
      },
    ],
  },
  {
    id: 'reducing',
    title: 'Stems whose vowels reduce',
    note: 'A qamets or tsere two syllables before the stress reduces to a sheva. The construct gives its stress to the next word, so it reduces further: its last vowel shortens, and two shevas at the head of a word resolve into a hireq.',
    columns: FULL,
    nouns: [
      {
        id: 'davar',
        lemma: 'דָּבָר',
        gloss: 'word, thing',
        gender: 'm',
        forms: { sgAbs: 'דָּבָר', sgCstr: 'דְּבַר', plAbs: 'דְּבָרִים', plCstr: 'דִּבְרֵי' },
      },
      {
        id: 'zaqen',
        lemma: 'זָקֵן',
        gloss: 'elder',
        gender: 'm',
        forms: { sgAbs: 'זָקֵן', sgCstr: 'זְקַן', plAbs: 'זְקֵנִים', plCstr: 'זִקְנֵי' },
      },
      {
        id: 'tsedaqah',
        lemma: 'צְדָקָה',
        gloss: 'righteousness',
        gender: 'f',
        forms: { sgAbs: 'צְדָקָה', sgCstr: 'צִדְקַת', plAbs: 'צְדָקוֹת', plCstr: 'צִדְקוֹת' },
      },
    ],
  },
  {
    id: 'segolates',
    title: 'Segolates',
    note: 'Two syllables, stressed on the first, with a helping vowel in the second — a segol, or a patah beside a guttural. The singular construct does not change. The plural takes the pattern of דְּבָרִים, and the original vowel returns in the plural construct.',
    columns: FULL,
    nouns: [
      {
        id: 'melekh',
        lemma: 'מֶלֶךְ',
        gloss: 'king',
        gender: 'm',
        forms: { sgAbs: 'מֶ֫לֶךְ', sgCstr: 'מֶ֫לֶךְ', plAbs: 'מְלָכִים', plCstr: 'מַלְכֵי' },
      },
      {
        id: 'shevet',
        lemma: 'שֵׁבֶט',
        gloss: 'tribe, rod',
        gender: 'm',
        forms: { sgAbs: 'שֵׁ֫בֶט', sgCstr: 'שֵׁ֫בֶט', plAbs: 'שְׁבָטִים', plCstr: 'שִׁבְטֵי' },
      },
      {
        id: 'hodesh',
        lemma: 'חֹדֶשׁ',
        gloss: 'month, new moon',
        gender: 'm',
        forms: { sgAbs: 'חֹ֫דֶשׁ', sgCstr: 'חֹ֫דֶשׁ', plAbs: 'חֳדָשִׁים', plCstr: 'חָדְשֵׁי' },
      },
      {
        id: 'naar',
        lemma: 'נַעַר',
        gloss: 'boy, servant',
        gender: 'm',
        forms: { sgAbs: 'נַ֫עַר', sgCstr: 'נַ֫עַר', plAbs: 'נְעָרִים', plCstr: 'נַעֲרֵי' },
      },
    ],
  },
  {
    id: 'duals',
    title: 'The dual',
    note: 'Used for things that come in pairs, above all parts of the body, and for a few measures of time. The dual construct is identical to the masculine plural construct.',
    columns: ['sgAbs', 'duAbs', 'duCstr'],
    nouns: [
      {
        id: 'yad',
        lemma: 'יָד',
        gloss: 'hand',
        gender: 'f',
        forms: { sgAbs: 'יָד', duAbs: 'יָדַ֫יִם', duCstr: 'יְדֵי' },
      },
      {
        id: 'regel',
        lemma: 'רֶגֶל',
        gloss: 'foot',
        gender: 'f',
        forms: { sgAbs: 'רֶ֫גֶל', duAbs: 'רַגְלַ֫יִם', duCstr: 'רַגְלֵי' },
      },
      {
        id: 'ayin',
        lemma: 'עַיִן',
        gloss: 'eye',
        gender: 'f',
        forms: { sgAbs: 'עַ֫יִן', duAbs: 'עֵינַ֫יִם', duCstr: 'עֵינֵי' },
      },
      {
        id: 'ozen',
        lemma: 'אֹזֶן',
        gloss: 'ear',
        gender: 'f',
        forms: { sgAbs: 'אֹ֫זֶן', duAbs: 'אָזְנַ֫יִם', duCstr: 'אָזְנֵי' },
      },
    ],
  },
];

export const allNouns: NounParadigm[] = nounGroups.flatMap((g) => g.nouns);

/** Things about nouns that are true across every pattern. */
export const nounNotes: string[] = [
  'Gender is a property of the word, not of its ending: אָב (father) takes a feminine-looking plural, אָבוֹת, and stays masculine, while נָשִׁים (women) is feminine with a masculine ending.',
  'The absolute is the free-standing form. The construct is bound to the noun that follows it and is translated with "of": דְּבַר הַמֶּלֶךְ, "the word of the king".',
  'A construct never takes the article. The whole chain is definite when its last noun is.',
];

// ─── The article ──────────────────────────────────────────────────────────────

export interface Example {
  /** The word before the change, where showing it helps. */
  from?: string;
  hebrew: string;
  gloss: string;
}

export interface FormRule {
  id: string;
  /** The situation, in a few words. */
  when: string;
  /** What is written — a prefix shown on a dotted circle, or a word. */
  form: string;
  /** Why, or what to notice. */
  note: string;
  examples: Example[];
}

/**
 * The article is הַ plus a doubling of the next consonant. Every other form is
 * what happens when that consonant cannot double.
 */
export const articleRules: FormRule[] = [
  {
    id: 'regular',
    when: 'Before most consonants',
    form: 'הַ + dagesh forte',
    note: 'The normal form. The first letter of the noun is doubled.',
    examples: [
      { from: 'מֶלֶךְ', hebrew: 'הַמֶּלֶךְ', gloss: 'the king' },
      { from: 'דָּבָר', hebrew: 'הַדָּבָר', gloss: 'the word' },
    ],
  },
  {
    id: 'aleph-ayin-resh',
    when: 'Before א, ע and ר',
    form: 'הָ',
    note: 'These cannot double, so the patah lengthens to a qamets to make up for it.',
    examples: [
      { from: 'אִישׁ', hebrew: 'הָאִישׁ', gloss: 'the man' },
      { from: 'עִיר', hebrew: 'הָעִיר', gloss: 'the city' },
      { from: 'רֹאשׁ', hebrew: 'הָרֹאשׁ', gloss: 'the head' },
    ],
  },
  {
    id: 'he-het',
    when: 'Before ה and ח',
    form: 'הַ',
    note: 'No dagesh and no lengthening: the guttural is treated as if it had doubled.',
    examples: [
      { from: 'הֵיכָל', hebrew: 'הַהֵיכָל', gloss: 'the temple' },
      { from: 'חֹדֶשׁ', hebrew: 'הַחֹדֶשׁ', gloss: 'the month' },
    ],
  },
  {
    id: 'unstressed-qamets',
    when: 'Before an unstressed הָ or עָ, and before any חָ',
    form: 'הֶ',
    note: 'The vowel shifts to a segol so that two a-vowels do not stand together.',
    examples: [
      { from: 'הָרִים', hebrew: 'הֶהָרִים', gloss: 'the mountains' },
      { from: 'עָרִים', hebrew: 'הֶעָרִים', gloss: 'the cities' },
      { from: 'חָכָם', hebrew: 'הֶחָכָם', gloss: 'the wise man' },
    ],
  },
  {
    id: 'stressed-qamets',
    when: 'Before a stressed הָ or עָ',
    form: 'הָ',
    note: 'With the stress on the first syllable the article lengthens instead.',
    examples: [
      { from: 'הַר', hebrew: 'הָהָר', gloss: 'the mountain' },
      { from: 'עַם', hebrew: 'הָעָם', gloss: 'the people' },
    ],
  },
];

/** A few common nouns change their own first vowel when the article is added. */
export const articleIrregulars: Example[] = [
  { from: 'אֶרֶץ', hebrew: 'הָאָרֶץ', gloss: 'the land' },
  { from: 'הַר', hebrew: 'הָהָר', gloss: 'the mountain' },
  { from: 'עַם', hebrew: 'הָעָם', gloss: 'the people' },
  { from: 'חַג', hebrew: 'הֶחָג', gloss: 'the feast' },
  { from: 'פַּר', hebrew: 'הַפָּר', gloss: 'the bull' },
  { from: 'אֲרוֹן', hebrew: 'הָאָרוֹן', gloss: 'the ark' },
];

export const articleNotes: string[] = [
  'Hebrew has no indefinite article. מֶלֶךְ is "a king" or just "king", as the sentence requires.',
  'A word beginning with יְ or מְ often drops the dagesh: הַיְלָדִים, "the children".',
  'After בְּ, לְ or כְּ the ה of the article drops out and the preposition takes its vowel: לַמֶּלֶךְ, "to the king".',
];

// ─── Prepositions ─────────────────────────────────────────────────────────────

/** The three prepositions written as a prefix on the word they govern. */
export const inseparablePrepositions: Example[] = [
  { hebrew: 'בְּ', gloss: 'in, at, with, by' },
  { hebrew: 'לְ', gloss: 'to, for' },
  { hebrew: 'כְּ', gloss: 'like, as, according to' },
];

/**
 * How בְּ, לְ and כְּ are pointed. The sheva is the form at rest; each other
 * rule is that sheva meeting something it cannot stand beside.
 */
export const inseparableRules: FormRule[] = [
  {
    id: 'sheva',
    when: 'Before most words',
    form: 'בְּ',
    note: 'The normal form, with a vocal sheva.',
    examples: [
      { hebrew: 'בְּיוֹם', gloss: 'in a day' },
      { hebrew: 'לְמֶלֶךְ', gloss: 'to a king' },
      { hebrew: 'כְּאִישׁ', gloss: 'like a man' },
    ],
  },
  {
    id: 'before-sheva',
    when: 'Before a sheva',
    form: 'בִּ',
    note: 'Two vocal shevas cannot begin a word, so the first becomes a hireq.',
    examples: [
      { from: 'בְּרִית', hebrew: 'בִּבְרִית', gloss: 'in a covenant' },
      { from: 'דְּבַר', hebrew: 'כִּדְבַר', gloss: 'according to the word of' },
    ],
  },
  {
    id: 'before-yod-sheva',
    when: 'Before יְ',
    form: 'בִּי',
    note: 'The hireq swallows the sheva under the yod, which becomes part of the vowel.',
    examples: [
      { from: 'יְהוּדָה', hebrew: 'בִּיהוּדָה', gloss: 'in Judah' },
      { from: 'יְהוּדָה', hebrew: 'לִיהוּדָה', gloss: 'to Judah' },
    ],
  },
  {
    id: 'before-hateph',
    when: 'Before a hateph vowel',
    form: 'בַּ / בֶּ / בָּ',
    note: 'The preposition takes the short vowel that matches the hateph.',
    examples: [
      { from: 'אֲשֶׁר', hebrew: 'כַּאֲשֶׁר', gloss: 'just as' },
      { from: 'אֱכֹל', hebrew: 'לֶאֱכֹל', gloss: 'to eat' },
      { from: 'אֳנִיּוֹת', hebrew: 'בָּאֳנִיּוֹת', gloss: 'in ships' },
    ],
  },
  {
    id: 'with-article',
    when: 'With the article',
    form: 'בַּ + dagesh forte',
    note: 'The ה drops and the preposition takes the vowel the article would have had, dagesh and all.',
    examples: [
      { from: 'הַמֶּלֶךְ', hebrew: 'לַמֶּלֶךְ', gloss: 'to the king' },
      { from: 'הַיּוֹם', hebrew: 'בַּיּוֹם', gloss: 'in the day' },
      { from: 'הָעִיר', hebrew: 'בָּעִיר', gloss: 'in the city' },
    ],
  },
  {
    id: 'before-elohim',
    when: 'Before אֱלֹהִים',
    form: 'בֵּ',
    note: 'The א goes silent and the vowel lengthens to a tsere.',
    examples: [
      { from: 'אֱלֹהִים', hebrew: 'לֵאלֹהִים', gloss: 'to God' },
      { from: 'אֱלֹהִים', hebrew: 'בֵּאלֹהִים', gloss: 'in God' },
    ],
  },
];

/** מִן, "from" — the one preposition that is written both ways. */
export const minRules: FormRule[] = [
  {
    id: 'separate',
    when: 'Standing apart',
    form: 'מִן־',
    note: 'Joined by a maqqef. This is the usual form before the article.',
    examples: [{ hebrew: 'מִן־הָאָרֶץ', gloss: 'from the land' }],
  },
  {
    id: 'prefixed',
    when: 'Prefixed, before most consonants',
    form: 'מִ + dagesh forte',
    note: 'The נ assimilates into the next consonant and doubles it.',
    examples: [
      { from: 'מֶלֶךְ', hebrew: 'מִמֶּלֶךְ', gloss: 'from a king' },
      { from: 'בַּיִת', hebrew: 'מִבַּיִת', gloss: 'from a house' },
    ],
  },
  {
    id: 'before-guttural',
    when: 'Prefixed, before a guttural or ר',
    form: 'מֵ',
    note: 'These cannot double, so the hireq lengthens to a tsere.',
    examples: [
      { from: 'אֶרֶץ', hebrew: 'מֵאֶרֶץ', gloss: 'from a land' },
      { from: 'עִיר', hebrew: 'מֵעִיר', gloss: 'from a city' },
      { from: 'רֹאשׁ', hebrew: 'מֵרֹאשׁ', gloss: 'from the top' },
    ],
  },
  {
    id: 'prefixed-article',
    when: 'Prefixed, before the article',
    form: 'מֵהַ',
    note: 'The article keeps its ה — unlike after בְּ, לְ and כְּ.',
    examples: [{ from: 'הָאָרֶץ', hebrew: 'מֵהָאָרֶץ', gloss: 'from the land' }],
  },
];

/** Prepositions that stand as their own word, most frequent first. */
export const independentPrepositions: Example[] = [
  { hebrew: 'אֶל', gloss: 'to, toward' },
  { hebrew: 'עַל', gloss: 'on, upon, over, against' },
  { hebrew: 'עַד', gloss: 'until, as far as' },
  { hebrew: 'עִם', gloss: 'with' },
  { hebrew: 'אֵת', gloss: 'with' },
  { hebrew: 'לִפְנֵי', gloss: 'before, in front of' },
  { hebrew: 'אַחֲרֵי', gloss: 'after, behind' },
  { hebrew: 'תַּחַת', gloss: 'under, instead of' },
  { hebrew: 'בֵּין', gloss: 'between' },
  { hebrew: 'בְּתוֹךְ', gloss: 'in the midst of' },
  { hebrew: 'אֵצֶל', gloss: 'beside' },
  { hebrew: 'נֶגֶד', gloss: 'opposite, in front of' },
  { hebrew: 'סָבִיב', gloss: 'around' },
  { hebrew: 'לְמַעַן', gloss: 'for the sake of, in order that' },
];

export const prepositionNotes: string[] = [
  'אֵת "with" is spelled like the marker of the definite direct object. With a suffix they part ways: אִתִּי is "with me", אֹתִי is "me".',
  'The short prepositions are usually joined to the next word by a maqqef — אֶל־, עַל־, עַד־ — and אֵת shortens before it, to אֶת־.',
];
