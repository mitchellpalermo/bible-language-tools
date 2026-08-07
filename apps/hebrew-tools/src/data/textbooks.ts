// Textbook chapter decks.
//
// Seminary Hebrew is taught chapter by chapter out of a specific grammar, and
// vocabulary quizzes are scoped to a chapter's list — not to a frequency band.
// This module turns the `chapters` tags carried on each `HebrewVocabWord` into
// ready-to-study decks.
//
// The tags live on the vocabulary entries rather than in a separate per-chapter
// word list here, so a word that appears in several textbooks (or in several
// chapters of the same textbook) is still a single entry with a single SRS card.
// That keeps `vocabulary.ts` the one source of truth; this module only queries it.

import { type HebrewVocabWord, vocabulary } from './vocabulary';

export type TextbookId = 'garrett-derouchie';

export interface Textbook {
  id: TextbookId;
  /** Full title, for attribution. */
  title: string;
  authors: string;
  /** Short label used in deck chips, e.g. "Garrett & DeRouchie". */
  shortTitle: string;
  /** Noun used for the numbered divisions of this book ("Chapter", "Unit"...). */
  unitLabel: string;
}

/** A word's membership in one chapter of one textbook. */
export interface TextbookChapterRef {
  textbook: TextbookId;
  chapter: number;
}

/** A chapter's vocabulary list, ready to hand to the flashcard session. */
export interface ChapterDeck {
  /** Stable identifier, e.g. `garrett-derouchie:1`. Used as the UI selection key. */
  id: string;
  textbook: TextbookId;
  chapter: number;
  /** Display label, e.g. "Garrett & DeRouchie Ch. 1". */
  label: string;
  /** Short display label for narrow chips, e.g. "Ch. 1". */
  shortLabel: string;
  words: HebrewVocabWord[];
}

export const TEXTBOOKS: Record<TextbookId, Textbook> = {
  'garrett-derouchie': {
    id: 'garrett-derouchie',
    title: 'A Modern Grammar for Biblical Hebrew',
    authors: 'Duane A. Garrett and Jason S. DeRouchie',
    shortTitle: 'Garrett & DeRouchie',
    unitLabel: 'Ch.',
  },
};

export const TEXTBOOK_IDS = Object.keys(TEXTBOOKS) as TextbookId[];

export function deckId(textbook: TextbookId, chapter: number): string {
  return `${textbook}:${chapter}`;
}

export function isInChapter(
  word: HebrewVocabWord,
  textbook: TextbookId,
  chapter: number,
): boolean {
  return (word.chapters ?? []).some((c) => c.textbook === textbook && c.chapter === chapter);
}

/** Every word tagged for the given textbook chapter, in vocabulary-file order. */
export function wordsInChapter(textbook: TextbookId, chapter: number): HebrewVocabWord[] {
  return vocabulary.filter((w) => isInChapter(w, textbook, chapter));
}

/**
 * Build every chapter deck that has at least one word, ordered by textbook then
 * chapter number. Chapters with no vocabulary tagged yet are omitted rather
 * than surfaced as empty decks.
 */
export function chapterDecks(textbook?: TextbookId): ChapterDeck[] {
  const ids = textbook ? [textbook] : TEXTBOOK_IDS;
  const decks: ChapterDeck[] = [];

  for (const id of ids) {
    const book = TEXTBOOKS[id];
    const chapters = new Set<number>();
    for (const word of vocabulary) {
      for (const ref of word.chapters ?? []) {
        if (ref.textbook === id) chapters.add(ref.chapter);
      }
    }

    for (const chapter of [...chapters].sort((a, b) => a - b)) {
      decks.push({
        id: deckId(id, chapter),
        textbook: id,
        chapter,
        label: `${book.shortTitle} ${book.unitLabel} ${chapter}`,
        shortLabel: `${book.unitLabel} ${chapter}`,
        words: wordsInChapter(id, chapter),
      });
    }
  }

  return decks;
}

/** Look up a deck by its `id`, or `undefined` if no such chapter has words. */
export function findDeck(id: string): ChapterDeck | undefined {
  return chapterDecks().find((d) => d.id === id);
}

export interface TextbookDeckGroup {
  textbook: Textbook;
  decks: ChapterDeck[];
}

/**
 * The same decks as `chapterDecks()`, grouped under their textbook so the UI can
 * label a row of chapter chips once instead of repeating the book's name on each.
 * Textbooks with no tagged vocabulary yet are omitted.
 */
export function chapterDecksByTextbook(): TextbookDeckGroup[] {
  const groups: TextbookDeckGroup[] = [];
  for (const deck of chapterDecks()) {
    const existing = groups.find((g) => g.textbook.id === deck.textbook);
    if (existing) existing.decks.push(deck);
    else groups.push({ textbook: TEXTBOOKS[deck.textbook], decks: [deck] });
  }
  return groups;
}
