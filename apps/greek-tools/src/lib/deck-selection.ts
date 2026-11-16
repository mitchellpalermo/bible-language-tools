// Which textbook deck and which chapters the student is studying (#228).
//
// The model is `@tools/shared/deck-selection`, shared with hebrew.tools. This
// binds it to this app's storage key and textbooks.
//
// It is a study posture, so it is persisted: a student on chapter 9 means it
// for the week. It is NOT part of the SRS store and never synced. Nothing here
// changes what is due; it only decides which cards `/flashcards` deals.
//
// The shared model can also name a custom deck (`deck: 'custom'`). This app
// does not write that yet: its custom decks still keep their own state in
// `Flashcards.tsx` until they move onto the shared deck store (#242). A stored
// `'custom'` therefore reads as no textbook, which `selectedTextbook` handles.

import {
  createDeckSelection,
  type DeckSelection as SharedDeckSelection,
  selectedTextbook,
} from '@tools/shared/deck-selection';
import {
  CATEGORY_IDS,
  DEFAULT_CATEGORIES,
  TEXTBOOK_IDS,
  type TextbookId,
  type VocabCategory,
} from '../data/textbooks';

export const DECK_SELECTION_KEY = 'greek-tools-deck-v1';

export type DeckSelection = SharedDeckSelection<TextbookId, VocabCategory>;

const model = createDeckSelection<TextbookId, VocabCategory>({
  storageKey: DECK_SELECTION_KEY,
  textbookIds: TEXTBOOK_IDS,
  categoryIds: CATEGORY_IDS,
  defaultCategories: DEFAULT_CATEGORIES,
});

export const DEFAULT_SELECTION: DeckSelection = model.defaultSelection;

export const { normalizeSelection, loadSelection, saveSelection } = model;

/** The textbook the selection names, or null when it names none. */
export function textbookOf(selection: DeckSelection): TextbookId | null {
  return selectedTextbook(selection, TEXTBOOK_IDS);
}
