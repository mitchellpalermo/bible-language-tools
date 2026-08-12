// What the student is currently studying: which deck, which chapters, which of
// the textbook's vocabulary sections.
//
// This is persisted because it is a study posture, not a momentary filter. A
// student narrowing to "chapters 1–8, core only" a week before a section exam
// means it for the week, and re-picking eight chapters on every page load is
// the kind of friction that stops people opening the app at all.
//
// It is deliberately NOT part of the SRS store. Nothing here affects what is
// due; it only decides which due cards are in front of you right now, so it
// stays local to the browser and is never synced.

import { CATEGORY_IDS, TEXTBOOK_IDS, type TextbookId, type VocabCategory } from '../data/textbooks';

const STORAGE_KEY = 'hebrew-tools-deck-v1';

export interface DeckSelection {
  /** `'all'` is the whole vocabulary; otherwise a textbook's chapter decks. */
  deck: 'all' | TextbookId;
  /** Selected chapter numbers. Empty means every chapter — see `wordsInChapters`. */
  chapters: number[];
  /** Textbook sections to include. Never empty after `normalizeSelection`. */
  categories: VocabCategory[];
}

export const DEFAULT_SELECTION: DeckSelection = {
  deck: 'all',
  chapters: [],
  categories: ['core'],
};

/**
 * Coerce anything read back from storage into a usable selection.
 *
 * Storage is shared with older builds of the app and with the user's own
 * devtools, so every field is treated as untrusted. The one rule with teeth is
 * that `categories` can never come back empty: an empty category list yields an
 * empty deck, and a student who lands on an empty deck with no obvious cause
 * has no way to tell a bug from an exhausted review queue.
 */
export function normalizeSelection(raw: unknown): DeckSelection {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SELECTION };
  const input = raw as Partial<Record<keyof DeckSelection, unknown>>;

  const deck =
    input.deck === 'all' || TEXTBOOK_IDS.includes(input.deck as TextbookId)
      ? (input.deck as 'all' | TextbookId)
      : DEFAULT_SELECTION.deck;

  const chapters = Array.isArray(input.chapters)
    ? [...new Set(input.chapters.filter((c): c is number => Number.isInteger(c) && c > 0))].sort(
        (a, b) => a - b,
      )
    : [];

  const categories = Array.isArray(input.categories)
    ? CATEGORY_IDS.filter((id) => (input.categories as unknown[]).includes(id))
    : [];

  return {
    deck,
    chapters,
    categories: categories.length > 0 ? categories : [...DEFAULT_SELECTION.categories],
  };
}

export function loadSelection(): DeckSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SELECTION };
    return normalizeSelection(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SELECTION };
  }
}

export function saveSelection(selection: DeckSelection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // A full or disabled localStorage must not interrupt a study session.
  }
}
