/**
 * What a word means, for a reader popup.
 *
 * **Strong's, everywhere.** `lemmas.json` carries a gloss for 9,248 of the
 * corpus's 9,256 lemmas, lifted from `HebrewStrong.xml` in the pinned OSHB
 * lexicon. The eight it cannot reach are the inseparable prefixes, which have
 * no Strong's entry at all — they are letter codes rather than numbers — and
 * they are supplied by the table below.
 *
 * **The textbook is deliberately not a source here**, and that is a decision
 * rather than an oversight. Garrett & DeRouchie's wording is authoritative for
 * the thing it is: the answer key for the deck built from that textbook, where
 * a quiz is marked against the page. It is not a general-purpose lexicon, and
 * letting it win across the whole Hebrew Bible would mean a word's meaning
 * changed depending on whether a course happened to teach it — the reader would
 * say one thing about חֶסֶד in Genesis and the lexicon another in Isaiah.
 *
 * So the split is by *use*, not by source quality: `Flashcards` reads
 * `word.gloss` off the vocabulary and is marked against the textbook; the
 * reader reads this module and is answerable to the lexicon. Nothing here
 * imports `vocabulary.ts`, which is what keeps the two from drifting into each
 * other.
 *
 * Two things Strong's does that will look like bugs and are not:
 *
 * - **BDB sense splits share a gloss.** `5892a` and `5892b` are both עִיר and
 *   both resolve to H5892, because Strong's draws no distinction there.
 *   Frequency deliberately behaves the other way — counts sum across sense
 *   splits and never across homographs.
 * - **Proper names keep Strong's own romanizations**, so H3478 reads "he will
 *   rule as God, Jisraël". The popup shows the pointed lemma beside the gloss,
 *   and a normalization rule for archaic spellings would break more than it
 *   fixed.
 */

import type { LemmaIndex } from '../data/morphhb';

/**
 * The eight inseparable prefixes, which no lexicon entry covers.
 *
 * They are 121,669 of the corpus's 305,516 tokens — the most-read letters on
 * the page — so a blank popup on a ל is not an option. These are the ordinary
 * lexicon glosses for them, and they are here rather than borrowed from the
 * course vocabulary for the reason above: the reader does not read the
 * textbook.
 */
const PREFIX_GLOSSES: Record<string, string> = {
  b: 'in, at, by, with',
  c: 'and',
  d: 'the',
  i: '(introduces a question)',
  k: 'like, as',
  l: 'to, for',
  m: 'from, out of',
  s: 'that, which, who',
};

/**
 * The gloss for a lemma key, or `undefined` when nothing has one.
 *
 * `lemmas` may be `null` — the index is ~140 KB and fetched lazily, and the
 * prefixes are answerable without it.
 */
export function glossFor(lemma: string, lemmas: LemmaIndex | null = null): string | undefined {
  return lemmas?.[lemma]?.gloss ?? PREFIX_GLOSSES[lemma];
}
