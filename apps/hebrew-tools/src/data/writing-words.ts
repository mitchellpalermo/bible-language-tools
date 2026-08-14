// Word-mode handwriting practice: whole words into a grid of guide boxes.
//
// The single-glyph decks in `writing.ts` drill the alphabet; this drills words,
// from the same vocabulary the flashcards use and under the same chapter
// selection. Everything about decks, SRS and grading that is not specific to
// *words* lives there, not here.
//
// Two things are load-bearing and neither is obvious:
//
// **One cell per consonant cluster, not per codepoint.** A cell holds a letter
// with its points — בְּ is the bet, its dagesh and its sheva together, because
// that is one act of writing. Splitting them across three cells would ask for
// something nobody writes. `splitClusters` in the shared engine is what decides
// this, and it does it by a Unicode rule so greek.tools inherits it (#105).
//
// **The grid is what removes ink segmentation from the problem.** The student
// says where each letter ends by writing it in its own box, so the engine never
// has to guess where one letter stops and the next begins. That is the whole
// reason word mode is tractable at all without a recognition model.

import { type GlyphCluster, splitClusters } from '@tools/shared/ink';
import { isDue, type SRSCard } from './srs';
import { type TextbookId, type VocabCategory, wordsInChapters } from './textbooks';
import { vocabulary } from './vocabulary';
import { cardKey, type HebrewVocabWord } from './vocabulary-types';

/**
 * SRS namespace for word-writing cards.
 *
 * A third prefix alongside `write:letter:` and `write:nikud:` (see
 * `writing.ts`), and it must stay distinct from both: a one-letter word like
 * the conjunction וְ would otherwise share a card with the vav *letter* drill,
 * and writing a word is not the same skill as writing its first letter.
 *
 * The suffix is `cardKey(word)`, never `word.hebrew` — homographs such as אַף
 * "also" and אַף "nose" are separate cards everywhere else in the app, and a
 * bare lemma here would silently merge them.
 */
export const WORD_KEY_PREFIX = 'write:word:';

export function wordCardKey(word: HebrewVocabWord): string {
  return `${WORD_KEY_PREFIX}${cardKey(word)}`;
}

export function isWordWritingKey(key: string): boolean {
  return key.startsWith(WORD_KEY_PREFIX);
}

/**
 * What the student is given to write from.
 *
 * Both are recall — the Hebrew is never shown — which is what separates word
 * mode from the letter decks' trace and copy steps. Tracing a whole word teaches
 * very little that tracing its letters has not already taught.
 */
export type WordPrompt = 'gloss' | 'transliteration';

export const WORD_PROMPTS: { id: WordPrompt; label: string; hint: string }[] = [
  { id: 'gloss', label: 'From the meaning', hint: 'Write the Hebrew for an English gloss' },
  {
    id: 'transliteration',
    label: 'From the sound',
    hint: 'Write the Hebrew for a transliteration',
  },
];

/** A word prepared for the grid. */
export interface WritingWord {
  word: HebrewVocabWord;
  /**
   * The guide boxes, in logical order — first-written first.
   *
   * NOT visual order. The grid fills right-to-left from `ScriptPack.direction`,
   * so reversing here as well would put the word back the wrong way round.
   */
  cells: GlyphCluster[];
  /** SRS key for the word as a whole. Per-cell progress is not tracked. */
  key: string;
}

export function toWritingWord(word: HebrewVocabWord): WritingWord {
  return { word, cells: splitClusters(word.hebrew), key: wordCardKey(word) };
}

/** Any character in the Hebrew block, including its points. */
const HEBREW = /[֐-׿יִ-ﭏ]/;

/**
 * A parenthetical aside at the end of a gloss.
 *
 * Garrett & DeRouchie annotate a fair number of entries inline — חָפֵץ reads
 * "desire, enjoy, want (the qatal 3ms is חָפֵץ but other forms are normal…)".
 * That note is useful on a flashcard back and fatal as a writing prompt,
 * because it prints the answer.
 */
const ASIDE = /\s*\([^()]*\)\s*$/;

/**
 * The gloss, reduced to something that can be asked without giving the word away.
 *
 * Returns null when it cannot be. A writing prompt is a different contract from
 * a flashcard back: the flashcard shows the Hebrew *and* the gloss together, so
 * a note quoting the form costs nothing, while here the student is being asked
 * to produce exactly that form.
 *
 * Trimming the aside recovers most of them. Where Hebrew survives the trim the
 * word is dropped rather than shown with the answer blanked out — a gloss with
 * a hole in it is a worse prompt than one fewer word, and the vocabulary is not
 * short of words.
 */
export function glossPrompt(gloss: string | undefined): string | null {
  if (!gloss) return null;
  const trimmed = (HEBREW.test(gloss) ? gloss.replace(ASIDE, '') : gloss).trim();
  if (trimmed.length === 0 || HEBREW.test(trimmed)) return null;
  return trimmed;
}

/**
 * Whether a word can be prompted the given way.
 *
 * Transliteration is the one that fails, and often: it is absent from the 546
 * generated Garrett & DeRouchie entries by design, because OSHB carries no
 * romanization and inventing them would be errors the data tests cannot catch.
 * Only the hand-curated entries carry one.
 *
 * So this is a real constraint on the deck, not a missing field to paper over.
 * The caller must narrow the queue rather than falling back to the gloss —
 * a prompt that silently changes to a different kind of prompt is worse than a
 * smaller deck, and the UI can say why the deck is small.
 */
export function hasPrompt(word: HebrewVocabWord, prompt: WordPrompt): boolean {
  return promptText(word, prompt) !== null;
}

/** The prompt text itself, or null when this word cannot be asked that way. */
export function promptText(word: HebrewVocabWord, prompt: WordPrompt): string | null {
  if (prompt === 'transliteration') return word.transliteration ?? null;
  return glossPrompt(word.gloss);
}

/**
 * The words a deck selection covers.
 *
 * Deliberately the same query the flashcards run, so a chapter chip means the
 * same set of words in both places. A student who has narrowed to "chapters
 * 1–8, core only" for the week expects that to hold across the app.
 */
export function wordsForSelection(
  deck: 'all' | TextbookId,
  chapters: number[],
  categories: VocabCategory[],
): HebrewVocabWord[] {
  return deck === 'all' ? [...vocabulary] : wordsInChapters(deck, chapters, categories);
}

/**
 * Order words for study: due first, then unseen, then the rest.
 *
 * Unlike the letter decks this DOES shuffle within each band. Alphabetical order
 * is part of what the alphabet drill teaches; vocabulary order is an artifact of
 * how the textbook was typed, and running it in file order would drill the same
 * words in the same sequence every session.
 *
 * Words that cannot carry the chosen prompt are dropped rather than reordered —
 * see `hasPrompt`.
 */
export function buildWordQueue(
  words: HebrewVocabWord[],
  store: Record<string, SRSCard>,
  prompt: WordPrompt,
  shuffle: <T>(items: T[]) => T[] = identity,
): WritingWord[] {
  const due: HebrewVocabWord[] = [];
  const fresh: HebrewVocabWord[] = [];

  for (const word of words) {
    if (!hasPrompt(word, prompt)) continue;
    const card = store[wordCardKey(word)];
    if (!card) fresh.push(word);
    else if (isDue(card)) due.push(word);
  }

  return [...shuffle(due), ...shuffle(fresh)].map(toWritingWord);
}

function identity<T>(items: T[]): T[] {
  return items;
}

/** How many words in the set have never been written. */
export function countNewWords(
  words: HebrewVocabWord[],
  store: Record<string, SRSCard>,
  prompt: WordPrompt,
): number {
  return words.filter(w => hasPrompt(w, prompt) && !store[wordCardKey(w)]).length;
}

/**
 * How many words in the set can be asked with the given prompt.
 *
 * Surfaced in the UI so that "From the sound" being nearly empty on a Garrett
 * chapter reads as a fact about the data rather than as a broken deck.
 */
export function countPromptable(words: HebrewVocabWord[], prompt: WordPrompt): number {
  return words.filter(w => hasPrompt(w, prompt)).length;
}

/**
 * A word's score from its cells' scores.
 *
 * The minimum, not the mean. A word is a sequence of letters and getting one
 * of them wrong is getting the word wrong — averaging lets four good letters
 * carry a fifth that is illegible, which is exactly the habit the drill exists
 * to break. Ungraded cells (no mask, no ink) are skipped; a word with nothing
 * graded scores null rather than zero.
 */
export function wordScore(cellScores: (number | null)[]): number | null {
  const graded = cellScores.filter((s): s is number => s !== null);
  return graded.length === 0 ? null : Math.min(...graded);
}
