import { fetchBook } from '../data/morphgnt';
import { normalizeKey } from '../data/srs';
import { vocabulary } from '../data/vocabulary';

// Build a Set of valid vocab keys for fast membership testing.
// MorphGNT lemmas are already in normalized form (e.g. 'ὁ' not 'ὁ, ἡ, τό'),
// so normalizeKey(w.greek) produces the key that matches the raw lemma.
const vocabKeySet: Set<string> = new Set(vocabulary.map((w) => normalizeKey(w.greek)));

/**
 * Returns the unique vocabulary word keys for all words in a GNT book.
 * Keys are normalized lemmas that exist in src/data/vocabulary.ts.
 * MorphGNT lemmas with no vocabulary entry are silently skipped.
 */
export async function getBookWordKeys(bookCode: string): Promise<string[]> {
  const book = await fetchBook(bookCode);
  const seen = new Set<string>();

  for (const chapter of Object.values(book)) {
    for (const verse of Object.values(chapter)) {
      for (const word of verse) {
        if (vocabKeySet.has(word.lemma)) {
          seen.add(word.lemma);
        }
      }
    }
  }

  return Array.from(seen);
}
