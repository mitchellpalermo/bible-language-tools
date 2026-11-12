// Custom flashcard decks: a name and a set of word keys. Language-agnostic.
//
// A word key is whatever the app's SRS store keys a card by, so a deck is a
// *selection* and never owns progress: reviewing a word in a deck, in a
// textbook chapter or in the whole vocabulary moves the same card.
//
// This is the storage factory, the sync merge and the shape of a deck for both
// apps (#225 on hebrew.tools; greek.tools keeps its own copy until it adopts
// this, see "Custom decks" in the repo CLAUDE.md). The selection model — which
// words a picked deck contributes to a session, and what restarts one — is here
// too, in `wordsInDeck` and `deckRestartPart`, so the textbook decks of #228
// build on the same two functions instead of a second implementation.
//
// DELETION IS A TOMBSTONE. The sync merge is a union, so a deck missing from
// one side reads as "not seen yet", never "removed", and a plain delete comes
// back on the next pull (the gap greek.tools still has). Deleting therefore
// keeps the row with `deletedAt` set and no words; the merge treats it as the
// newest edit. See `mergeCustomDecks`.

import {
  isIso,
  isLive,
  isRecord,
  mergeTombstoned,
  pruneTombstones,
  stampOf,
  TOMBSTONE_TTL_DAYS,
} from './tombstones';

// The tombstone rules moved to `tombstones.ts` when focus passages (#226)
// began sharing them; re-exported so this module's callers did not change.
export { isLive, pruneTombstones, stampOf, TOMBSTONE_TTL_DAYS };

export const MAX_DECK_NAME = 60;
/** Bounds that only stop a hostile request body; no student reaches them. */
export const MAX_DECKS = 100;
export const MAX_DECK_WORDS = 5000;
export const MAX_ID_LENGTH = 100;
export const MAX_KEY_LENGTH = 200;

export interface CustomDeck {
  /** `crypto.randomUUID()`. Never reused, so a tombstone cannot hide a new deck. */
  id: string;
  /** User-provided, trimmed, at most `MAX_DECK_NAME` characters. */
  name: string;
  /** SRS store keys. Empty on a tombstone. */
  wordKeys: string[];
  /** ISO timestamp. */
  createdAt: string;
  /**
   * ISO timestamp of the last create, edit or delete, which is what the merge
   * compares. Absent on a deck written before sync (greek.tools'), where
   * `createdAt` stands in.
   */
  updatedAt?: string;
  /** Set when the deck was deleted. The deck is then a tombstone, not a deck. */
  deletedAt?: string;
}

/**
 * One deck from untrusted input — storage, or a request body — or null when it
 * is not one. Word keys are de-duplicated and sorted, so two devices that pick
 * the same words hold the same deck, and a tombstone is normalized to carry no
 * words.
 */
export function parseDeck(raw: unknown): CustomDeck | null {
  if (!isRecord(raw)) return null;
  const { id, name, wordKeys, createdAt, updatedAt, deletedAt } = raw;
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LENGTH) return null;
  if (typeof name !== 'string' || name.length > MAX_DECK_NAME) return null;
  if (!isIso(createdAt)) return null;
  if (updatedAt !== undefined && !isIso(updatedAt)) return null;
  if (deletedAt !== undefined && !isIso(deletedAt)) return null;
  if (!Array.isArray(wordKeys) || wordKeys.length > MAX_DECK_WORDS) return null;
  if (wordKeys.some((k) => typeof k !== 'string' || k.length === 0 || k.length > MAX_KEY_LENGTH)) {
    return null;
  }

  const deck: CustomDeck = {
    id,
    name,
    wordKeys: deletedAt === undefined ? [...new Set(wordKeys as string[])].sort() : [],
    createdAt,
  };
  if (updatedAt !== undefined) deck.updatedAt = updatedAt;
  if (deletedAt !== undefined) deck.deletedAt = deletedAt;
  return deck;
}

/** Every deck in `raw` that is one, in order. For reading storage, which a student can edit. */
export function parseDecks(raw: unknown): CustomDeck[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const decks: CustomDeck[] = [];
  for (const entry of raw) {
    const deck = parseDeck(entry);
    if (deck && !seen.has(deck.id)) {
      seen.add(deck.id);
      decks.push(deck);
    }
  }
  return decks;
}

/** All-or-nothing, for a request body: one bad deck rejects the list. Returns it parsed, or null. */
export function parseDeckList(raw: unknown): CustomDeck[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_DECKS) return null;
  const decks: CustomDeck[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const deck = parseDeck(entry);
    if (!deck || seen.has(deck.id)) return null;
    seen.add(deck.id);
    decks.push(deck);
  }
  return decks;
}

// ─── The merge ────────────────────────────────────────────────────────────────

/**
 * Per deck id: the latest change wins, whole — an edit on one device and a
 * rename on another do not combine. A deck edited *after* it was deleted
 * elsewhere comes back; one edited before does not. The rules, the symmetry and
 * the known clock limit are `mergeTombstoned`'s.
 */
export function mergeCustomDecks(
  a: CustomDeck[],
  b: CustomDeck[],
  now: Date = new Date(),
): CustomDeck[] {
  return mergeTombstoned(a, b, now);
}

// ─── Rules about names and words ─────────────────────────────────────────────

/** Why this name cannot be saved, or null when it can. Case-insensitive among live decks. */
export function deckNameError(
  name: string,
  decks: CustomDeck[],
  editingId: string | null = null,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Deck name is required.';
  if (trimmed.length > MAX_DECK_NAME) return `Name must be ${MAX_DECK_NAME} characters or fewer.`;
  const taken = decks.some(
    (d) => isLive(d) && d.id !== editingId && d.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  return taken ? 'A deck with that name already exists.' : null;
}

// ─── Selection ───────────────────────────────────────────────────────────────

/** The live deck with this id, or null: no id, an unknown one, or a deck deleted since it was picked. */
export function findDeck(decks: CustomDeck[], id: string | null): CustomDeck | null {
  if (id === null) return null;
  return decks.find((d) => d.id === id && isLive(d)) ?? null;
}

/**
 * The words a deck contributes to a session, in the order the app lists them
 * (not the order they were added), so two sessions over one deck deal the same
 * way. A key the vocabulary no longer has is skipped; it stays in the deck.
 */
export function wordsInDeck<T>(
  deck: CustomDeck | null,
  words: readonly T[],
  getKey: (word: T) => string,
): T[] {
  if (!deck) return [];
  const keys = new Set(deck.wordKeys);
  return words.filter((w) => keys.has(getKey(w)));
}

/**
 * What a deck adds to a session's `restartKey`: its id and its *sorted* words,
 * and not its name. Renaming a deck mid-session must not throw the session
 * away; editing its words must deal a new one. (`parseDeck` keeps `wordKeys`
 * sorted, so the sort here is for decks that did not come through it.)
 */
export function deckRestartPart(deck: CustomDeck | null): [string | null, string[]] {
  return deck ? [deck.id, [...deck.wordKeys].sort()] : [null, []];
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export interface CustomDeckStore {
  /** Every deck including tombstones: what sync reads and merges. */
  loadAll(): CustomDeck[];
  /** The live decks: what the UI shows. */
  load(): CustomDeck[];
  /** Replace what is stored. Throws when storage cannot be written. */
  saveAll(decks: CustomDeck[]): void;
  /** Throws when storage cannot be written. */
  create(name: string, wordKeys: string[]): CustomDeck;
  /** Returns the live decks. */
  update(id: string, patch: { name?: string; wordKeys?: string[] }): CustomDeck[];
  /** Tombstones the deck. Returns the live decks. */
  remove(id: string): CustomDeck[];
}

/**
 * Deck storage bound to one key, as every other store in this package is: both
 * apps run the feature, and neither may read the other's decks.
 *
 * `clock` is injectable so a test does not depend on the time.
 */
export function createCustomDeckStore(
  storageKey: string,
  clock: () => Date = () => new Date(),
): CustomDeckStore {
  function loadAll(): CustomDeck[] {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? parseDecks(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  function saveAll(decks: CustomDeck[]): void {
    localStorage.setItem(storageKey, JSON.stringify(decks));
  }

  const live = (decks: CustomDeck[]) => decks.filter(isLive);

  /** Apply `change` to one stored deck, stamping it, and return the live list. */
  function change(id: string, apply: (deck: CustomDeck, stamp: string) => CustomDeck) {
    const stamp = clock().toISOString();
    const decks = loadAll().map((d) => (d.id === id && isLive(d) ? apply(d, stamp) : d));
    saveAll(decks);
    return live(decks);
  }

  return {
    loadAll,
    load: () => live(loadAll()),
    saveAll,
    create(name, wordKeys) {
      const stamp = clock().toISOString();
      const deck: CustomDeck = {
        id: crypto.randomUUID(),
        name: name.trim(),
        wordKeys: [...new Set(wordKeys)].sort(),
        createdAt: stamp,
        updatedAt: stamp,
      };
      saveAll([...loadAll(), deck]);
      return deck;
    },
    update: (id, patch) =>
      change(id, (deck, stamp) => ({
        ...deck,
        name: patch.name === undefined ? deck.name : patch.name.trim(),
        wordKeys:
          patch.wordKeys === undefined ? deck.wordKeys : [...new Set(patch.wordKeys)].sort(),
        updatedAt: stamp,
      })),
    remove: (id) =>
      change(id, (deck, stamp) => ({
        ...deck,
        wordKeys: [],
        updatedAt: stamp,
        deletedAt: stamp,
      })),
  };
}
