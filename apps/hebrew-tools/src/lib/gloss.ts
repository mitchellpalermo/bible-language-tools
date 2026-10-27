/**
 * What a word means, for a reader popup and the gloss line under a verse.
 *
 * **BDB first, then Strong's.** `glosses.json` carries a short gloss for every
 * numbered lemma, built from `BrownDriverBriggs.xml` in the pinned OSHB
 * lexicon, and BDB's senses for each stem a verb is used in (issue #131,
 * widened from verbs to every lemma). Strong's, in `lemmas.json`, is the fallback when that file has
 * not loaded. The build already falls back where BDB is bare — a pinned BDB
 * sense for a few common words, a proper name's transliteration, then Strong's
 * — so nothing here has to choose between them word by word.
 *
 * Why BDB: Strong's lists a word's senses undifferentiated and often leads
 * with the root's. Its first sense for גַּם is "assemblage", for מְלָאכָה
 * "deputyship", for קָנָה "erect" — five wrong words in fourteen in Nehemiah
 * 5:16. BDB's is "also", "occupation, work" and "get, acquire". And Strong's
 * cannot say what a stem does: חָזַק gets the same thirteen glosses as a Qal, a
 * Piel and a Hithpael.
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
 */

import type { GlossIndex, HebrewWord, LemmaIndex } from '../data/morphhb';
import { analyzeWord } from './morph-parse';

/**
 * The eight inseparable prefixes, which no lexicon entry covers.
 *
 * They are 121,669 of the corpus's 305,516 tokens — the most-read letters on
 * the page — so a blank popup on a ל is not an option. These are the ordinary
 * lexicon glosses for them, and they are here rather than borrowed from the
 * course vocabulary for the reason above: the reader does not read the
 * textbook. `glosses.json` skips them on purpose — BDB's own entry for ו opens
 * "so, then".
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

/** Either index may be `null` — both are fetched lazily and either can fail. */
export interface GlossSources {
  glosses?: GlossIndex | null;
  lemmas?: LemmaIndex | null;
}

/**
 * The gloss for a lemma key, or `undefined` when nothing has one.
 *
 * BDB's short gloss, else Strong's, else the prefix table. The prefixes answer
 * without either index.
 */
export function glossFor(
  lemma: string,
  { glosses, lemmas }: GlossSources = {},
): string | undefined {
  const bdb = glosses?.[lemma]?.g;
  if (bdb && bdb.length > 0) return bdb.join(', ');
  return lemmas?.[lemma]?.gloss ?? PREFIX_GLOSSES[lemma];
}

/** The binyan of a word's verb, or `undefined` for a word with no verb in it. */
export function stemOf(word: Pick<HebrewWord, 'text' | 'parsing'>): string | undefined {
  // Only verbs carry a stem, so the first morpheme that has one is the verb's.
  return analyzeWord(word).find((part) => part.analysis?.stem)?.analysis?.stem;
}

/**
 * BDB's senses for a verb in one stem, most common first, or `undefined` when
 * BDB lists none for that stem. A missing stem renders as nothing, not as
 * "no senses" — the gloss above it still stands.
 */
export function stemSenses(
  lemma: string,
  stem: string | undefined,
  glosses: GlossIndex | null,
): string[][] | undefined {
  if (!stem) return undefined;
  const senses = glosses?.[lemma]?.s?.[stem];
  return senses && senses.length > 0 ? senses : undefined;
}

/**
 * How long a gloss line may run before it drops to one item. A line wider than
 * the Hebrew above it pushes the next word along, and a verse of those reads
 * as a table, not a text.
 */
export const LINE_MAX = 18;

/**
 * What the gloss line shows under a word: its head lemma's meaning, short.
 *
 * - **A verb shows its stem's first sense**, so הֶחֱזַקְתִּי (Hiphil) reads "make
 *   strong", not the Qal's "be or grow firm". A stem BDB lists nothing for
 *   falls back to the lemma's gloss.
 * - **Only the head lemma is glossed.** The prefixes on וְגַם and בִּמְלֶאכֶת are
 *   in the popup's morpheme table; glossing them too would turn a word line into
 *   a phrase line. A word that *is* a prefix — לוֹ, a ל with a suffix — gets the
 *   prefix's gloss.
 * - **Two items where they fit, else one.**
 */
export function lineGloss(
  word: Pick<HebrewWord, 'lemma' | 'text' | 'parsing'>,
  glosses: GlossIndex | null,
): string | undefined {
  const sense = stemSenses(word.lemma, stemOf(word), glosses)?.[0];
  const items = sense ?? glosses?.[word.lemma]?.g ?? PREFIX_GLOSSES[word.lemma]?.split(', ');
  if (!items || items.length === 0) return undefined;
  const two = items.slice(0, 2).join(', ');
  return two.length <= LINE_MAX ? two : items[0];
}
