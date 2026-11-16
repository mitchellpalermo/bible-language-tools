// What the student is currently studying: which deck, which chapters, which of
// the textbook's vocabulary sections.
//
// The model itself (what a selection is, how one read back from storage is
// coerced, what happens when its custom deck is deleted) is
// `@tools/shared/deck-selection`, shared with greek.tools (#228). This module
// binds it to this app's storage key, textbooks and categories.
//
// It is deliberately NOT part of the SRS store. Nothing here affects what is
// due; it only decides which due cards are in front of you right now, so it
// stays local to the browser and is never synced.

import {
  createDeckSelection,
  type DeckSelection as SharedDeckSelection,
} from '@tools/shared/deck-selection';
import {
  CATEGORY_IDS,
  DEFAULT_CATEGORIES,
  TEXTBOOK_IDS,
  type TextbookId,
  type VocabCategory,
} from '../data/textbooks';

const STORAGE_KEY = 'hebrew-tools-deck-v1';

export type DeckSelection = SharedDeckSelection<TextbookId, VocabCategory>;

const model = createDeckSelection<TextbookId, VocabCategory>({
  storageKey: STORAGE_KEY,
  textbookIds: TEXTBOOK_IDS,
  categoryIds: CATEGORY_IDS,
  defaultCategories: DEFAULT_CATEGORIES,
});

export const DEFAULT_SELECTION: DeckSelection = model.defaultSelection;

export const { normalizeSelection, loadSelection, saveSelection } = model;

export { effectiveSelection } from '@tools/shared/deck-selection';
