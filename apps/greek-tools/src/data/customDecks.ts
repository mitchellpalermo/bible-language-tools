// ─── Custom Deck data layer ───────────────────────────────────────────────────
//
// Custom decks are user-created vocabulary word lists stored in localStorage.
// Words are referenced by their normalized lemma key (same key format as the
// SRS store), so SRS progress is shared across all decks and built-in presets.

export interface CustomDeck {
  id: string; // crypto.randomUUID()
  name: string; // user-provided, max 60 chars
  wordKeys: string[]; // normalizeKey() values from vocabulary
  createdAt: string; // ISO date string
}

export const CUSTOM_DECKS_KEY = 'greek-tools-custom-decks-v1';

export function loadCustomDecks(): CustomDeck[] {
  try {
    const raw = localStorage.getItem(CUSTOM_DECKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomDeck[];
  } catch {
    return [];
  }
}

export function saveCustomDecks(decks: CustomDeck[]): void {
  localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(decks));
}

export function createCustomDeck(name: string, wordKeys: string[]): CustomDeck {
  const deck: CustomDeck = {
    id: crypto.randomUUID(),
    name: name.trim(),
    wordKeys,
    createdAt: new Date().toISOString(),
  };
  const existing = loadCustomDecks();
  saveCustomDecks([...existing, deck]);
  return deck;
}

export function updateCustomDeck(
  id: string,
  patch: Partial<Pick<CustomDeck, 'name' | 'wordKeys'>>,
): CustomDeck[] {
  const decks = loadCustomDecks();
  const updated = decks.map((d) =>
    d.id === id
      ? { ...d, ...patch, name: patch.name !== undefined ? patch.name.trim() : d.name }
      : d,
  );
  saveCustomDecks(updated);
  return updated;
}

export function deleteCustomDeck(id: string): CustomDeck[] {
  const decks = loadCustomDecks();
  const updated = decks.filter((d) => d.id !== id);
  saveCustomDecks(updated);
  return updated;
}
