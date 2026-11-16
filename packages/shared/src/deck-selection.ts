// What the student is currently studying: which deck, which chapters, which of
// the textbook's vocabulary sections. Language-agnostic; each app binds it to
// its own storage key, textbooks and categories.
//
// This is persisted because it is a study posture, not a momentary filter. A
// student narrowing to "chapters 1–8, core only" a week before a section exam
// means it for the week, and re-picking eight chapters on every page load is
// the kind of friction that stops people opening the app at all.
//
// It is deliberately NOT part of the SRS store. Nothing here affects what is
// due; it only decides which due cards are in front of you right now, so it
// stays local to the browser and is never synced.

import { type CustomDeck, findDeck } from './custom-decks';

export interface DeckSelection<B extends string = string, C extends string = string> {
  /**
   * `'all'` is the whole vocabulary; `'custom'` is the student's own deck, named
   * by `customDeckId`; otherwise a textbook's chapter decks.
   */
  deck: 'all' | 'custom' | B;
  /** Which custom deck. Null unless `deck` is `'custom'`: `normalizeSelection` enforces it. */
  customDeckId: string | null;
  /** Selected chapter numbers. Empty means every chapter: see `wordsInChapters`. */
  chapters: number[];
  /** Textbook sections to include. Never empty after `normalizeSelection`. */
  categories: C[];
}

export interface DeckSelectionModel<B extends string, C extends string> {
  /** The whole vocabulary, no chapters, the default categories. Treat as read-only. */
  defaultSelection: DeckSelection<B, C>;
  /**
   * Coerce anything read back from storage into a usable selection.
   *
   * Storage is shared with older builds of the app and with the student's own
   * devtools, so every field is treated as untrusted. The one rule with teeth
   * is that `categories` can never come back empty: an empty category list
   * yields an empty deck, and a student who lands on an empty deck with no
   * obvious cause has no way to tell a bug from an exhausted review queue.
   */
  normalizeSelection(raw: unknown): DeckSelection<B, C>;
  loadSelection(): DeckSelection<B, C>;
  saveSelection(selection: DeckSelection<B, C>): void;
}

/**
 * The selection model bound to one storage key, as every other store in this
 * package is: both apps run the feature, and neither may read the other's.
 *
 * The textbook list is data. A deck id that is not in `textbookIds` (a book
 * removed since, or another app's) reads as the whole vocabulary.
 */
export function createDeckSelection<B extends string, C extends string>(options: {
  storageKey: string;
  textbookIds: readonly B[];
  /** Every category, in the order the chips show them. */
  categoryIds: readonly C[];
  /** What a fresh selection includes. Must not be empty. */
  defaultCategories: readonly C[];
}): DeckSelectionModel<B, C> {
  const { storageKey, textbookIds, categoryIds, defaultCategories } = options;

  const fresh = (): DeckSelection<B, C> => ({
    deck: 'all',
    customDeckId: null,
    chapters: [],
    categories: [...defaultCategories],
  });

  function normalizeSelection(raw: unknown): DeckSelection<B, C> {
    if (typeof raw !== 'object' || raw === null) return fresh();
    const input = raw as Partial<Record<keyof DeckSelection, unknown>>;

    // A custom deck with no id names nothing, so it is the whole vocabulary
    // rather than an empty deck with no visible cause.
    const customDeckId =
      typeof input.customDeckId === 'string' && input.customDeckId.length > 0
        ? input.customDeckId
        : null;

    const deck: DeckSelection<B, C>['deck'] =
      input.deck === 'all' || textbookIds.includes(input.deck as B)
        ? (input.deck as 'all' | B)
        : input.deck === 'custom' && customDeckId !== null
          ? 'custom'
          : 'all';

    const chapters = Array.isArray(input.chapters)
      ? [...new Set(input.chapters.filter((c): c is number => Number.isInteger(c) && c > 0))].sort(
          (a, b) => a - b,
        )
      : [];

    const categories = Array.isArray(input.categories)
      ? categoryIds.filter((id) => (input.categories as unknown[]).includes(id))
      : [];

    return {
      deck,
      customDeckId: deck === 'custom' ? customDeckId : null,
      chapters,
      categories: categories.length > 0 ? categories : [...defaultCategories],
    };
  }

  return {
    defaultSelection: fresh(),
    normalizeSelection,

    loadSelection() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return fresh();
        return normalizeSelection(JSON.parse(raw));
      } catch {
        return fresh();
      }
    },

    saveSelection(selection) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(selection));
      } catch {
        // A full or disabled localStorage must not interrupt a study session.
      }
    },
  };
}

/**
 * The selection as the student can actually study it. A custom deck that has
 * since been deleted (here, or on another device and synced) is no deck, and
 * the selection falls back to the whole vocabulary instead of dealing nothing.
 * The stored selection is left alone: it is corrected the next time the student
 * picks a deck.
 */
export function effectiveSelection<S extends DeckSelection>(selection: S, decks: CustomDeck[]): S {
  if (selection.deck !== 'custom' || findDeck(decks, selection.customDeckId)) return selection;
  return { ...selection, deck: 'all', customDeckId: null };
}

/** The textbook a selection names, or null for the whole vocabulary or a custom deck. */
export function selectedTextbook<B extends string>(
  selection: DeckSelection<B>,
  textbookIds: readonly B[],
): B | null {
  return textbookIds.find((id) => id === selection.deck) ?? null;
}
