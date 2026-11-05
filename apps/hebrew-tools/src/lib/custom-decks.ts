// The student's own flashcard decks on hebrew.tools (#225).
//
// The storage, merge and builder are `@tools/shared/custom-decks`; this file
// binds them to this app's storage key and its vocabulary. A deck holds SRS
// store keys, the same `normalizeKey(cardKey(word))` the flashcards review
// under, so studying a word in a deck, in a textbook chapter or in the whole
// vocabulary moves one card.
//
// Decks sync to the account (`ProgressSnapshot.customDecks`), and deleting one
// leaves a tombstone so it stays deleted on every device.

import type { DeckBuilderWord } from '@tools/shared/components/DeckBuilder';
import { type CustomDeck, createCustomDeckStore, wordsInDeck } from '@tools/shared/custom-decks';
import { normalizeKey } from '../data/srs';
import { cardKey, type HebrewVocabWord, vocabulary } from '../data/vocabulary';
import { stripAllDiacritics } from './hebrew-input';

export const CUSTOM_DECKS_KEY = 'hebrew-tools-custom-decks-v1';

export const customDeckStore = createCustomDeckStore(CUSTOM_DECKS_KEY);

/** The key a deck holds for a word: the one its SRS card is stored under. */
export const deckKey = (word: HebrewVocabWord) => normalizeKey(cardKey(word));

/** The vocabulary words a deck covers, in vocabulary order. */
export function wordsOfDeck(
  deck: CustomDeck | null,
  words: readonly HebrewVocabWord[] = vocabulary,
): HebrewVocabWord[] {
  return wordsInDeck(deck, words, deckKey);
}

/**
 * The vocabulary as the builder lists it. The search text holds the gloss, the
 * transliteration where there is one, and the Hebrew without its points and
 * accents, so a student can find a word by typing it bare.
 */
export function builderWords(words: readonly HebrewVocabWord[] = vocabulary): DeckBuilderWord[] {
  return words.map((w) => ({
    key: deckKey(w),
    label: w.hebrew,
    detail: w.gloss,
    search: `${w.gloss} ${w.transliteration ?? ''} ${stripAllDiacritics(w.hebrew)}`.toLowerCase(),
  }));
}
