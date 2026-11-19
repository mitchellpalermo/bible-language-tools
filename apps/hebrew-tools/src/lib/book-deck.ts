// Decks built from the Hebrew Bible's text (#267, #270): the loader the
// flashcards read a deck's source through, and a deck from a whole book.
//
// Both go through the focus-passage join (`passageVocabulary`, `courseKeysOf`
// in focus-passages.ts), so a book deck holds the words Focus Passages would
// list for the same verses, and a chapter of it holds the ones that occur in
// that chapter. The lemma index is what finds the vocabulary entries with no
// Strong's number; when it fails to load the text is still read, and those
// few words are simply not found.

import type { DeckSource } from '@tools/shared/custom-decks';
import { wholeBookSource } from '@tools/shared/deck-source';
import { versesInRange } from '@tools/shared/focus-passages';
import type { LoadedSource } from '@tools/shared/use-deck-source';
import { fetchBook, fetchLemmas, type HebrewWord, type LemmaIndex } from '../data/morphhb';
import { courseKeysOf, passageDeckKeys, passageVocabulary } from './focus-passages';

async function lemmasOrNull(): Promise<LemmaIndex | null> {
  try {
    return await fetchLemmas();
  } catch {
    return null;
  }
}

/** A book and its word join, for `useDeckSource`. Module-level, so it is stable. */
export async function loadHebrewSource(bookCode: string): Promise<LoadedSource<HebrewWord>> {
  const [book, lemmas] = await Promise.all([fetchBook(bookCode), lemmasOrNull()]);
  return { book, keysOf: courseKeysOf(lemmas) };
}

/** Every course word of a book, one card per lexeme, and the book as the deck's source. */
export async function buildBookDeck(
  bookCode: string,
): Promise<{ wordKeys: string[]; source: DeckSource | null }> {
  const [book, lemmas] = await Promise.all([fetchBook(bookCode), lemmasOrNull()]);
  const source = wholeBookSource(bookCode, book);
  if (!source) return { wordKeys: [], source: null };
  return {
    wordKeys: passageDeckKeys(passageVocabulary(versesInRange(book, source), lemmas)),
    source,
  };
}
