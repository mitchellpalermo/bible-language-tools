// The student's own flashcard decks on greek.tools.
//
// The storage, the merge and the shape of a deck are `@tools/shared/custom-decks`
// (#242), shared with hebrew.tools; this file binds them to this app's storage
// key and keeps the function names the rest of the app has always called.
//
// A deck holds SRS store keys (`normalizeKey(word.greek)`), so progress is
// shared across every deck, the textbook chapters and the frequency presets.
//
// Deleting a deck leaves a tombstone, so a deck deleted here stays deleted on
// every device instead of coming back on the next sync. A deck built from a
// book or passage records its `source` (#267, #270).

import {
  type CustomDeck,
  createCustomDeckStore,
  type DeckSource,
} from '@tools/shared/custom-decks';

export type { CustomDeck, DeckSource };

export const CUSTOM_DECKS_KEY = 'greek-tools-custom-decks-v1';

export const customDeckStore = createCustomDeckStore(CUSTOM_DECKS_KEY);

/** The live decks: what the deck row and the builder show. */
export function loadCustomDecks(): CustomDeck[] {
  return customDeckStore.load();
}

/** Every deck, tombstones included: what sync reads and merges. */
export function loadAllCustomDecks(): CustomDeck[] {
  return customDeckStore.loadAll();
}

/** Replace what is stored, tombstones included. Throws when storage cannot be written. */
export function saveCustomDecks(decks: CustomDeck[]): void {
  customDeckStore.saveAll(decks);
}

/** Throws when storage cannot be written. Pass `source` for a deck built from the text. */
export function createCustomDeck(
  name: string,
  wordKeys: string[],
  source?: DeckSource,
): CustomDeck {
  return customDeckStore.create(name, wordKeys, source);
}

/** Returns the live decks. Editing by hand keeps the deck's source. */
export function updateCustomDeck(
  id: string,
  patch: { name?: string; wordKeys?: string[]; source?: DeckSource },
): CustomDeck[] {
  return customDeckStore.update(id, patch);
}

/** Tombstones the deck. Returns the live decks. */
export function deleteCustomDeck(id: string): CustomDeck[] {
  return customDeckStore.remove(id);
}
