/**
 * What a word means, for a reader popup.
 *
 * Three sources, in this order, and the order is the whole design:
 *
 * 1. **The course vocabulary** (`src/data/vocabulary.ts`), where it has an
 *    entry. Committed, hand-checked, worded as Garrett & DeRouchie word it.
 * 2. **Strong's**, from the OSHB lexicon, via `lemmas.json`. 9,248 of the
 *    corpus's 9,256 lemmas.
 * 3. **A two-entry table below**, for the inseparable prefixes that neither has.
 *
 * This is the split the repo already documents for the vocabulary build: a
 * retyped handout is the best available authority on what the course expects,
 * and Strong's is the only authority available for the other 8,700 lemmas.
 *
 * **The join happens here rather than in the pipeline**, and that is deliberate.
 * `lemmas.json` is generated and gitignored; `vocabulary.ts` is committed source.
 * Folding the second into the first would put course wording behind a 24 MB
 * build step, and hand-editing the result would lose it on the next build.
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
import { vocabulary } from '../data/vocabulary';

/**
 * The two inseparable prefixes that no source covers.
 *
 * All eight are letter codes rather than Strong's numbers — the lexicon has no
 * entry for any of them — but six are course vocabulary and come through the
 * curated join above: `b`, `c`, `d`, `i`, `k`, `l`. These two are not, and they
 * are far too common to leave a popup blank on.
 */
const PREFIX_GLOSSES: Record<string, string> = {
  m: 'from, out of',
  s: 'that, which, who',
};

let curated: Map<string, string> | null = null;

/**
 * Course glosses by lemma key, built once.
 *
 * **Only citation forms count, and `frequency` is what says a card is one.**
 * An Inflected or Reading card's front is a form lifted from a passage, and its
 * gloss is a gloss of *that form*: מְלָכִים is "kings", and a reader hovering
 * מֶלֶךְ wants "king". Those cards deliberately carry no frequency — the repo's
 * existing marker for the distinction, since a count is a fact about the lexeme
 * and not about the form — so excluding them costs nothing and asking for them
 * would put a plural where a singular belongs.
 *
 * A lexeme with two citation cards keeps the first; there is no such case
 * today, and the data tests reject two entries that share a headword and
 * resolve to the same lemma.
 */
function curatedGlosses(): Map<string, string> {
  if (curated) return curated;
  const map = new Map<string, string>();
  for (const word of vocabulary) {
    if (word.strong && word.frequency !== undefined && !map.has(word.strong)) {
      map.set(word.strong, word.gloss);
    }
  }
  curated = map;
  return map;
}

/** Drop the built lookup. Exists for tests. */
export function clearGlossCache(): void {
  curated = null;
}

/**
 * The gloss for a lemma key, or `undefined` when nothing has one.
 *
 * `lemmas` may be `null` — the index is ~140 KB and fetched lazily, and a word
 * the course teaches is glossable before it arrives.
 */
export function glossFor(lemma: string, lemmas: LemmaIndex | null = null): string | undefined {
  return curatedGlosses().get(lemma) ?? lemmas?.[lemma]?.gloss ?? PREFIX_GLOSSES[lemma];
}
