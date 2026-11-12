// Focus passages on hebrew.tools (#226): a verse range the student chose, and
// what it says about the vocabulary.
//
// The storage, merge and range arithmetic are `@tools/shared/focus-passages`;
// this file binds them to this app's storage key and adds the one thing that is
// Hebrew, which is reading a passage's words against the course vocabulary.
//
// A passage owns no progress. Its vocabulary is the course words whose lexeme
// occurs in the verses, reviewed under the same SRS cards as everywhere else, so
// "how well do I know this passage" is read from the store each time and
// nothing is kept beside it.
//
// THE JOIN IS THE READER'S, WITH ONE ADDITION. A word in the text carries an
// OSHB lemma key (`1254a`), the vocabulary carries a `strong`, and the two meet
// through `lemmaBase` exactly as the reader's "studied" underline does (see
// studied.ts): BDB sense splits are one lexeme, homographs are not. 28 of the
// vocabulary's entries carry no `strong` (curated chapter-1 words such as אֶרֶץ
// and מֶלֶךְ, which the handout import never reached), and a passage that skipped
// them would call "earth" a word the course lacks. They are matched by their
// pointed form against the lemma index instead, and only where one lexeme dominates
// that form.
//
// A lexeme the vocabulary has no entry for is shown, with what the lemma index
// knows of it, but is not in the deck: the deck is a selection of cards, and
// there is no card to select.

import {
  createFocusPassageStore,
  type MaturityBreakdown,
  maturityBreakdown,
  type PassageVerse,
} from '@tools/shared/focus-passages';
import type { SRSCard } from '@tools/shared/srs';
import type { HebrewWord, LemmaIndex } from '../data/morphhb';
import { isDue, normalizeKey } from '../data/srs';
import { cardKey, type HebrewVocabWord, vocabulary } from '../data/vocabulary';
import { stripCantillation } from './hebrew-input';
import { lemmaBase } from './studied';

export const FOCUS_PASSAGES_KEY = 'hebrew-tools-focus-passages-v1';

export const focusPassageStore = createFocusPassageStore(FOCUS_PASSAGES_KEY);

/** The SRS key a passage's word is reviewed under: the same one the deck builder holds. */
export const passageWordKey = (word: HebrewVocabWord) => normalizeKey(cardKey(word));

/** One course word the passage uses. */
export interface PassageWord {
  /** The entry that stands for the lexeme, and whose card a deck holds. */
  word: HebrewVocabWord;
  /** Every SRS key the vocabulary offers for the lexeme; studying any of them is studying it. */
  keys: string[];
  /** `lemmaBase` of the lexeme, which is how the text names it. */
  lemma: string;
  /** Times the lexeme occurs in the passage. */
  occurrences: number;
}

/** A lexeme in the passage the course vocabulary has no entry for. */
export interface OutsideLexeme {
  /** The lemma key as the text writes it (`1254a`), for the lemma index. */
  lemma: string;
  occurrences: number;
}

export interface PassageVocabulary {
  /** Course words in the passage, commonest in it first, then in order of appearance. */
  words: PassageWord[];
  /** Lexemes the vocabulary lacks, commonest first. */
  outside: OutsideLexeme[];
  /** Every word of the passage, repeats included. */
  runningWords: number;
}

/**
 * The vocabulary entry that stands for a lexeme.
 *
 * The vocabulary lists a lexeme more than once where the textbook teaches an
 * inflected form (וַיֹּאמֶר beside אָמַר), and a deck holding both would deal one
 * word twice. The lexical entry is the one OSHB gave a frequency; the inflected
 * forms get none (see vocabulary-garrett.ts), so that is the tell. A lexeme with
 * only inflected entries is represented by the first of them.
 */
function primaryEntry(entries: HebrewVocabWord[]): HebrewVocabWord {
  return entries.find((e) => e.frequency !== undefined) ?? entries[0];
}

const plain = (form: string) => stripCantillation(form).normalize('NFC');

/**
 * A form that one lexeme owns this much of the occurrences among the lexemes
 * written with it is that lexeme's. מֶלֶךְ is "king" (4428, thousands of
 * occurrences) and also Melech and an Aramaic noun (a few dozen between them);
 * אַף is "also" and "nose" in nearly equal measure and belongs to neither.
 */
const DOMINANT_SHARE = 0.9;

/**
 * Where an entry with no `strong` is found by its form: the lemma index's
 * numbered lexemes by pointed headword, each form mapped to the lexeme that
 * dominates it or left out when none does. Built only when there is an entry to
 * find, since it walks nine thousand lemmas.
 */
function lexemesByForm(lemmas: LemmaIndex): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const [key, entry] of Object.entries(lemmas)) {
    if (!entry.hebrew || !/^\d/.test(key)) continue;
    const form = plain(entry.hebrew);
    const held = counts.get(form) ?? new Map<string, number>();
    held.set(lemmaBase(key), (held.get(lemmaBase(key)) ?? 0) + entry.count);
    counts.set(form, held);
  }
  const byForm = new Map<string, string>();
  for (const [form, held] of counts) {
    const total = [...held.values()].reduce((sum, n) => sum + n, 0);
    const [top, n] = [...held].sort((x, y) => y[1] - x[1])[0];
    if (n >= total * DOMINANT_SHARE) byForm.set(form, top);
  }
  return byForm;
}

/**
 * Vocabulary entries by the lexeme they are. An entry with a `strong` is that
 * lexeme. One without is matched by its pointed form to the lexeme that
 * dominates it: a true homograph (אַף "also" and "nose") has no safe answer, so
 * it stays outside rather than being attributed to a guess. That is the same
 * rule OSHB's own build follows for its unmatched lemmas.
 */
function entriesByLemma(
  words: readonly HebrewVocabWord[],
  lemmas: LemmaIndex | null | undefined,
): Map<string, HebrewVocabWord[]> {
  const index = new Map<string, HebrewVocabWord[]>();
  const add = (base: string, word: HebrewVocabWord) => {
    const held = index.get(base);
    if (held) held.push(word);
    else index.set(base, [word]);
  };
  let byForm: Map<string, string> | undefined;
  for (const word of words) {
    if (word.strong) {
      add(lemmaBase(word.strong), word);
    } else if (lemmas) {
      byForm ??= lexemesByForm(lemmas);
      const base = byForm.get(plain(word.hebrew));
      if (base) add(base, word);
    }
  }
  return index;
}

/**
 * What a passage asks of the course vocabulary.
 *
 * Lexemes are counted by head lemma, which is what a word's `lemma` is. The
 * eight inseparable-prefix codes (`b`, `l`, `c`, ...) are not lexemes of the
 * lexicon and are left out of `outside`; a prefix is a grammar topic, and a line
 * of "to, for" among a passage's words would be noise.
 *
 * `lemmas` is the lemma index, for the entries with no `strong`; without it
 * those entries are simply not found.
 */
export function passageVocabulary(
  verses: readonly PassageVerse<HebrewWord>[],
  lemmas?: LemmaIndex | null,
  vocab: readonly HebrewVocabWord[] = vocabulary,
): PassageVocabulary {
  const counts = new Map<string, { lemma: string; n: number }>();
  let runningWords = 0;
  for (const { words } of verses) {
    for (const word of words) {
      runningWords++;
      const base = lemmaBase(word.lemma);
      const held = counts.get(base);
      if (held) held.n++;
      else counts.set(base, { lemma: word.lemma, n: 1 });
    }
  }

  const entries = entriesByLemma(vocab, lemmas);
  const inCourse: PassageWord[] = [];
  const outside: OutsideLexeme[] = [];
  for (const [base, { lemma, n }] of counts) {
    const held = entries.get(base);
    if (held) {
      inCourse.push({
        word: primaryEntry(held),
        keys: held.map(passageWordKey),
        lemma: base,
        occurrences: n,
      });
    } else if (/^\d/.test(base)) {
      outside.push({ lemma, occurrences: n });
    }
  }
  // Array.prototype.sort is stable, so ties keep their order of appearance.
  inCourse.sort((a, b) => b.occurrences - a.occurrences);
  outside.sort((a, b) => b.occurrences - a.occurrences);
  return { words: inCourse, outside, runningWords };
}

/** The SRS keys of the passage's course words, one per lexeme: what a deck made from it holds. */
export function passageDeckKeys(passageVocab: PassageVocabulary): string[] {
  return passageVocab.words.map(({ word }) => passageWordKey(word));
}

export interface PassageProgress {
  /** Course words in the passage, by how well they are known. */
  words: MaturityBreakdown;
  /** Course words whose card is due for review now. */
  due: number;
  /**
   * The share of the passage's running words, repeats counted, whose lexeme the
   * student has answered correctly at least once (0 to 1). It is what reading
   * the passage would feel like: a lexeme that fills a tenth of the verses
   * moves it ten times what a hapax does.
   */
  known: number;
}

/**
 * Where the student stands on a passage, read from the SRS store.
 *
 * "Known" uses the bar the reader's underline uses: any card of the lexeme
 * answered correctly at least once (`repetition > 0`), so a card dealt and
 * failed is not a word you know. Lexemes outside the course vocabulary have no
 * card and count as unknown, which is the truth about them.
 */
export function passageProgress(
  passageVocab: PassageVocabulary,
  store: Record<string, SRSCard>,
): PassageProgress {
  const keys = passageDeckKeys(passageVocab);
  const knownWords = passageVocab.words
    .filter(({ keys: all }) => all.some((key) => (store[key]?.repetition ?? 0) > 0))
    .reduce((sum, { occurrences }) => sum + occurrences, 0);
  return {
    words: maturityBreakdown(keys, store),
    due: keys.filter((key) => store[key] && isDue(store[key])).length,
    known: passageVocab.runningWords === 0 ? 0 : knownWords / passageVocab.runningWords,
  };
}
