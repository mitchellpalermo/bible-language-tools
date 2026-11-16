import { beforeEach, describe, expect, it } from 'vitest';
import {
  DECK_SELECTION_KEY,
  DEFAULT_SELECTION,
  loadSelection,
  normalizeSelection,
  saveSelection,
  textbookOf,
} from './deck-selection';

// The model's rules are tested in @tools/shared's deck-selection.test.ts. This
// checks the Greek binding: its key, its textbooks and its one category.

beforeEach(() => {
  localStorage.clear();
});

describe('the Greek deck selection', () => {
  it('starts on the whole vocabulary', () => {
    expect(DEFAULT_SELECTION).toEqual({
      deck: 'all',
      customDeckId: null,
      chapters: [],
      categories: ['vocabulary'],
    });
    expect(textbookOf(DEFAULT_SELECTION)).toBeNull();
  });

  it('is stored under this app’s own key', () => {
    saveSelection({ ...DEFAULT_SELECTION, deck: 'beginning-with-nt-greek', chapters: [4] });
    expect(DECK_SELECTION_KEY).toBe('greek-tools-deck-v1');
    expect(JSON.parse(localStorage.getItem(DECK_SELECTION_KEY) ?? '{}').chapters).toEqual([4]);
    expect(textbookOf(loadSelection())).toBe('beginning-with-nt-greek');
  });

  it('reads hebrew.tools’ textbook, or any book it does not have, as none', () => {
    expect(textbookOf(normalizeSelection({ deck: 'garrett-derouchie', chapters: [2] }))).toBeNull();
  });

  it('reads a stored custom deck as no textbook', () => {
    // Custom decks keep their own state on /flashcards until #242.
    expect(textbookOf(normalizeSelection({ deck: 'custom', customDeckId: 'd1' }))).toBeNull();
  });
});
