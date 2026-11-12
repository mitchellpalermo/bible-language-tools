// "Study these words": a focus passage's vocabulary as a flashcard deck (#226).
//
// A deck is a selection of SRS keys (see custom-decks.ts), so a passage's words
// become one by saving those keys as a custom deck and picking it. Nothing new
// stores or schedules anything: reviewing a word through the deck moves the same
// card as reviewing it anywhere, and the deck syncs, renames and deletes like
// any other the student made.
//
// The deck is a snapshot taken when the button is pressed, because a deck is a
// list of words and not a rule. The passage's words do not change (the text is
// fixed), but the vocabulary can, and a deck that followed it would reshuffle
// under a student mid-review.

import { MAX_DECK_NAME } from '@tools/shared/custom-decks';
import { customDeckStore } from './custom-decks';
import { loadSelection, saveSelection } from './deck-selection';

/** What the deck for a passage is called. The prefix keeps it from colliding with a deck the student named. */
export function passageDeckName(title: string): string {
  const prefix = 'Passage: ';
  return `${prefix}${title.trim()}`.slice(0, MAX_DECK_NAME).trimEnd();
}

/**
 * Save the passage's words as a deck and make it the one the flashcards open
 * on. Studying a passage twice updates its deck rather than stacking a second,
 * which is what looking it up by name is for. Returns the deck's id. Throws if
 * storage cannot be written, and changes nothing then.
 */
export function saveStudyDeck(title: string, wordKeys: string[]): string {
  const name = passageDeckName(title);
  const held = customDeckStore.load().find((d) => d.name === name);
  let id: string;
  if (held) {
    customDeckStore.update(held.id, { wordKeys });
    id = held.id;
  } else {
    id = customDeckStore.create(name, wordKeys).id;
  }
  saveSelection({ ...loadSelection(), deck: 'custom', customDeckId: id });
  return id;
}
