// The paradigm ladder (#199): the tables on /paradigms in the order they are
// learned. Which rungs are open is `@tools/shared/ladder`'s job; this file is
// only which tables there are and in what order.
//
// Four things are load-bearing:
//
// **A rung is one table, and its id is the table's id.** Progress is stored
// under it, so renaming a table id (`noun-2m-os`) forgets every student's clean
// writes of that rung. The table's forms are not repeated here: they stay in
// `grammar.ts`, where the quiz, the Grammar page and the parse drills read them,
// so a corrected form is corrected on the ladder too.
//
// **The order is difficulty, not the order a course happens to teach.** It
// follows the issue's sketch: the article first (every later table leans on it),
// the regular nouns, the third declension, adjectives and the participle as a
// noun, the pronouns, then the verb, active before middle and passive.
//
// **Nothing here is copied from a textbook.** The sequence is a general
// reading of how Greek grammar builds; the `detail` lines are written for this
// app. Forms are `grammar.ts`'s, and `paradigm-ladder.test.ts` checks the noun,
// adjective, article and pronoun rungs against the Greek New Testament (the
// MorphGNT corpus) and the verb endings against other verbs' attested endings.
//
// **A Greek instructor still needs to review the rungs** (#199): the order, and
// the forms the corpus cannot vouch for (`UNATTESTED` in the test names each).
//
// Rungs are one per table, so the ladder is long on purpose: a rung is a few
// minutes of work, and "two clean writes" means the same thing on all of them.
// Not on the ladder, though still in the quiz: νεανίας (the 1st-declension
// masculine), the subjunctive, imperative and infinitive tables, the other
// participles, and the remaining pronouns. An eta-stem noun (#41) has no table
// yet, so it has no rung.

export interface LadderRungSpec {
  /** The `TableModel` id. Stable: ladder progress is stored under it. */
  id: string;
  /** What this rung adds to the one below. */
  detail: string;
}

export const LADDER_RUNGS: readonly LadderRungSpec[] = [
  { id: 'article', detail: 'The article: three genders, four cases, everything else leans on it' },
  { id: 'noun-2m-os', detail: '2nd declension masculine: the pattern the article mirrors' },
  { id: 'noun-2n-on', detail: '2nd declension neuter: same endings, with neuter rules' },
  { id: 'noun-1f-alpha-pure', detail: '1st declension feminine: α stays α through the singular' },
  {
    id: 'noun-1f-alpha-impure',
    detail: '1st declension feminine: α turns to η in the genitive and dative',
  },
  { id: 'noun-3-mute', detail: '3rd declension: a stem ending in a stop, so the stem shows' },
  { id: 'noun-3-i-stem', detail: '3rd declension: ι-stem' },
  { id: 'noun-3-u-stem', detail: '3rd declension: υ-stem' },
  {
    id: 'noun-3-s-stem',
    detail: '3rd declension: neuter σ-stem, where the σ drops out and vowels meet',
  },
  {
    id: 'adj-adj-2-1-2',
    detail: 'Adjectives: masculine and neuter from the 2nd declension, feminine from the 1st',
  },
  { id: 'adj-adj-3-1-3', detail: 'Adjectives: masculine and neuter from the 3rd declension' },
  {
    id: 'participle-pres-act-ptc',
    detail: 'The participle as a noun: three genders on the 3-1-3 pattern',
  },
  { id: 'pronoun-ego', detail: 'Pronouns: the first person, with its short forms' },
  { id: 'pronoun-autos', detail: 'Pronouns: αὐτός, an adjective pattern used on its own' },
  { id: 'pronoun-outos', detail: 'Pronouns: οὗτος, the near demonstrative' },
  {
    id: 'verb-pres-act-ind',
    detail: 'Verbs: present active indicative, the endings every tense reuses',
  },
  {
    id: 'verb-impf-act-ind',
    detail: 'Verbs: imperfect active, the same endings with a past augment',
  },
  { id: 'verb-fut-act-ind', detail: 'Verbs: future active, a σ before the present endings' },
  { id: 'verb-aor-act-ind', detail: 'Verbs: aorist active, the first-aorist endings' },
  { id: 'verb-perf-act-ind', detail: 'Verbs: perfect active, reduplication and κ' },
  {
    id: 'verb-pres-mid-ind',
    detail: 'Verbs: present middle and passive, one set of endings for both',
  },
  {
    id: 'verb-aor-mid-ind',
    detail: 'Verbs: aorist middle, the first-aorist σα with middle endings',
  },
  { id: 'verb-aor-pass-ind', detail: 'Verbs: aorist passive, θη with active-style endings' },
];

/** Rung ids in ladder order. What `rungStates` and `newlyUnlocked` read. */
export const LADDER_RUNG_IDS: string[] = LADDER_RUNGS.map((r) => r.id);
