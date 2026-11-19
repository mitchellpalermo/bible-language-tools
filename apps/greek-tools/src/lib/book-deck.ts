import type { DeckSource } from '@tools/shared/custom-decks';
import { wholeBookSource } from '@tools/shared/deck-source';
import type { LoadedSource } from '@tools/shared/use-deck-source';
import { fetchBook, type MorphWord } from '../data/morphgnt';
import { normalizeKey } from '../data/srs';
import { vocabulary } from '../data/vocabulary';

// Build a Set of valid vocab keys for fast membership testing.
// MorphGNT lemmas are already in normalized form (e.g. 'ὁ' not 'ὁ, ἡ, τό'),
// so normalizeKey(w.greek) produces the key that matches the raw lemma.
const vocabKeySet: Set<string> = new Set(vocabulary.map((w) => normalizeKey(w.greek)));

/**
 * The SRS keys a word of the text is an occurrence of: its lemma, when the
 * vocabulary has a card for it, else none. The same direct match the book
 * and passage decks are built with, so a deck's words and their chapters and
 * verses (#267, #270) agree.
 */
export function greekKeysOf(word: MorphWord): readonly string[] {
  const key = normalizeKey(word.lemma);
  return vocabKeySet.has(key) ? [key] : [];
}

/** A book and its word join, for `useDeckSource`. Module-level, so it is stable. */
export async function loadGreekSource(bookCode: string): Promise<LoadedSource<MorphWord>> {
  return { book: await fetchBook(bookCode), keysOf: greekKeysOf };
}

/**
 * The unique vocabulary word keys of a GNT book, and the whole book as the
 * deck's source. MorphGNT lemmas with no vocabulary entry are skipped.
 */
export async function getBookDeck(
  bookCode: string,
): Promise<{ wordKeys: string[]; source: DeckSource | null }> {
  const book = await fetchBook(bookCode);
  const seen = new Set<string>();
  for (const chapter of Object.values(book)) {
    for (const verse of Object.values(chapter)) {
      for (const word of verse) {
        for (const key of greekKeysOf(word)) seen.add(key);
      }
    }
  }
  return { wordKeys: Array.from(seen), source: wholeBookSource(bookCode, book) };
}

/** The unique vocabulary word keys of a GNT book. */
export async function getBookWordKeys(bookCode: string): Promise<string[]> {
  return (await getBookDeck(bookCode)).wordKeys;
}
