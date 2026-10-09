// The shape of a vocabulary entry, split out from `vocabulary.ts` so that the
// generated `vocabulary-garrett.ts` can import it without a module cycle.

import type { TextbookChapterRef, VocabCategory } from './textbooks';

/**
 * Shorthand for tagging a word as Garrett & DeRouchie chapter vocabulary.
 *
 * It lives here, not in `textbooks.ts`, to keep the import graph acyclic:
 * `textbooks.ts` reads the vocabulary at module scope, so anything the
 * vocabulary files need at module scope has to come from somewhere upstream of
 * it. This module imports nothing but types, which erase at runtime.
 */
export const gd = (chapter: number, category: VocabCategory): TextbookChapterRef => ({
  textbook: 'garrett-derouchie',
  chapter,
  category,
});

/**
 * Grammatical gender as the standard lexica and grammars list it. `fm` marks
 * nouns attested as both (e.g. חָצֵר). Proper names and non-nominals are left
 * undefined.
 */
export type HebrewGender = 'm' | 'f' | 'fm';

/**
 * Which conjugation the form on a verb's card is.
 *
 * The four indicative conjugations take their Hebrew names, same as the brief
 * labels in `morph-parse.ts` and the textbook's own usage. The list is wider
 * than the four because the vocabulary is: בָּרוּךְ is listed as a passive
 * participle, and calling it anything else would be a wrong answer on a card.
 */
export const VERB_CONJUGATIONS = [
  'qatal',
  'weqatal',
  'yiqtol',
  'wayyiqtol',
  'imperative',
  'participle',
  'passive participle',
  'infinitive construct',
  'infinitive absolute',
] as const;

export type VerbConjugation = (typeof VERB_CONJUGATIONS)[number];

/** One binyan's worth of meaning for a verb the textbook lists across stems. */
export interface VerbStemGloss {
  /** Qal, Niphal, Piel, Pual, Hiphil, Hophal, Hithpael, Polel. */
  stem: string;
  /**
   * The form the textbook prints for this stem. Absent when the book refers the
   * student back to an earlier chapter instead of reprinting the form.
   */
  form?: string;
  gloss: string;
}

export interface HebrewVocabWord {
  /** Fully pointed form (BHS standard), or the bare root for verbs listed by root. */
  hebrew: string;
  /**
   * Distinguishes homographs that must not share an SRS card — בָּרוּךְ the name
   * from בָּרוּךְ "blessed", אַף "also" from אַף "nose". Only set where a clash
   * exists; see `cardKey`.
   */
  sense?: string;
  /** Triliteral root, when unambiguous. */
  root?: string;
  /**
   * Augmented Strong's number — the key into `public/data/morphhb/lemmas.json`,
   * and the lexeme's identity.
   *
   * Present on every entry OSHB could resolve. It is what makes `sense` checkable
   * rather than merely asserted: two entries that share a headword and carry
   * different Strong's numbers are demonstrably different words, which is the
   * thing `sense` was hand-claiming before. `sense` still drives `cardKey`,
   * because re-keying the SRS store would throw away the progress on those cards.
   */
  strong?: string;
  /**
   * SBL general-purpose transliteration. Optional: the textbook import has no
   * romanization, and guessing ~500 of them would bake in errors the data tests
   * cannot catch. Render it only when present.
   */
  transliteration?: string;
  gloss: string;
  /**
   * Approximate occurrence count. Optional for the same reason as
   * `transliteration` — real per-lemma counts arrive with the OSHB pipeline
   * (issue #75). A word without one is simply outside the frequency bands.
   */
  frequency?: number;
  partOfSpeech: string;
  /** Nouns (and textbook-listed adjectives) only. */
  gender?: HebrewGender;
  /** For verbs: Qal, Niphal, Piel, etc. */
  binyan?: string;
  /**
   * For verbs: the conjugation of the form in `hebrew`.
   *
   * A Hebrew verb's dictionary form is its qatal 3ms — כָּתַב is "he wrote" — even
   * though a lexicon glosses it with a bare English verb ("write"). Stating the
   * conjugation is what stops that gloss reading as an infinitive, and what tells
   * a citation form apart from the inflected forms the early chapters list
   * (יִבְחַר, וַיֹּאמֶר). Absent only on a verb listed by its bare root, which is
   * not a form of anything.
   */
  conjugation?: VerbConjugation;
  /** Construct form, where the textbook prints one. */
  construct?: string;
  /** Irregular plural, where the textbook prints one. */
  plural?: string;
  /** Alternate spellings the textbook lists for the same word. */
  alternates?: string[];
  /** Per-stem glosses, for verbs the textbook lists across several binyanim. */
  stems?: VerbStemGloss[];
  /** The textbook's own explanatory note on the entry. */
  note?: string;
  /** Textbook chapter vocabulary lists this word belongs to. */
  chapters?: TextbookChapterRef[];
}

/**
 * The SRS store key for a word.
 *
 * Almost always the bare Hebrew string — which is what makes progress on a word
 * survive it being tagged into another chapter. Homographs are the exception:
 * two unrelated words spelled identically would otherwise share one card, so
 * they carry a `sense` that separates them. The `#` is safe as a separator
 * because it cannot occur in a Hebrew headword.
 */
export function cardKey(word: HebrewVocabWord): string {
  return word.sense ? `${word.hebrew}#${word.sense}` : word.hebrew;
}

/**
 * A verb card's parse as one label — "Qal qatal", "Hiphil yiqtol".
 *
 * Stem first, the order a grammar parses in. Either half may be missing (a verb
 * listed by bare root has no conjugation) and the label is whatever is left;
 * `undefined` means there is nothing to print, which is every non-verb.
 */
export function verbParse(
  word: Pick<HebrewVocabWord, 'binyan' | 'conjugation'>,
): string | undefined {
  const parts = [word.binyan, word.conjugation].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
}
