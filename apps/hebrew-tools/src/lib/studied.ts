/**
 * Which words on the page the student has already studied.
 *
 * The reader knows a word by its OSHB lemma key — an augmented Strong's number
 * like `1254a`, or a letter code like `l` for an inseparable preposition. The
 * SRS store knows a word by `cardKey`, which is a *pointed Hebrew headword*.
 * Nothing joins those two directly, so the join runs through the vocabulary:
 *
 *     word.lemma → vocabulary entry (by `strong`) → cardKey → SRS card
 *
 * **`cardKey` is the key, never the bare lemma.** The vocabulary separates
 * homographs by sense — בָּרוּךְ the name and בָּרוּךְ "blessed" are different cards —
 * and `normalizeKey(word.hebrew)` is the exact bug that convention replaced.
 * Reaching into the store with anything else would underline a word the student
 * has never seen because an unrelated homograph shares its spelling.
 *
 * Two properties of the join worth knowing:
 *
 * - **BDB sense splits are one lexeme here.** `5892a` and `5892b` are both עִיר,
 *   so a card tagged `5892b` underlines a `5892a` in the text. This is the same
 *   rule `gloss.ts` follows — Strong's draws no distinction — and it stops the
 *   highlight depending on which split the corpus happened to code a given
 *   occurrence as. Homographs are *not* collapsed: `5893` is a different word
 *   spelled the same way, and it keeps its own answer.
 * - **A lemma can carry several cards.** The vocabulary lists inflected and
 *   reading forms alongside citation forms, and they resolve to the same
 *   lexeme — וַיֹּאמֶר and אָמַר are two cards over one Strong's number. Studying
 *   either one is studying the word, so any card counts.
 */

import { loadSRSStore, normalizeKey, type SRSCard } from '../data/srs';
import { cardKey, type HebrewVocabWord, vocabulary } from '../data/vocabulary';

/**
 * The lexeme a lemma key names, with any BDB sense-split letter dropped.
 *
 * `1254a` → `1254`. A prefix's letter code has no number in it at all and comes
 * back unchanged, which is what keeps the eight of them from collapsing onto
 * each other — and onto every lemma the corpus writes without a number.
 */
export function lemmaBase(lemma: string): string {
  const digits = /^\d+/.exec(lemma);
  return digits ? digits[0] : lemma;
}

/**
 * Every SRS key the vocabulary offers for a lexeme, indexed by `lemmaBase`.
 *
 * Entries OSHB could not resolve carry no `strong` and are absent — they have
 * no lemma to be found by, which is a gap in the join and not an error.
 */
export function lemmaCardKeys(words: HebrewVocabWord[] = vocabulary): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const word of words) {
    if (!word.strong) continue;
    const base = lemmaBase(word.strong);
    const keys = index.get(base);
    const key = normalizeKey(cardKey(word));
    if (keys) keys.push(key);
    else index.set(base, [key]);
  }
  return index;
}

/**
 * The lexemes the student has a review history on, as `lemmaBase` keys.
 *
 * `repetition > 0` is "has been answered correctly at least once", which is the
 * same bar greek.tools sets. A card dealt and failed is not a word you know.
 */
export function studiedLemmas(
  store: Record<string, SRSCard>,
  words: HebrewVocabWord[] = vocabulary,
): Set<string> {
  const studied = new Set<string>();
  for (const [base, keys] of lemmaCardKeys(words)) {
    if (keys.some((key) => (store[key]?.repetition ?? 0) > 0)) studied.add(base);
  }
  return studied;
}

/**
 * The same set, read from localStorage.
 *
 * A store that will not parse yields an empty set: highlighting is an aid, and
 * losing it is not a reason to fail the reader.
 */
export function loadStudiedLemmas(): Set<string> {
  try {
    return studiedLemmas(loadSRSStore());
  } catch {
    return new Set();
  }
}
