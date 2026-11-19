import {
  mergeCustomDecks,
  parseDecks,
  type CustomDeck as SharedDeck,
} from '@tools/shared/custom-decks';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CUSTOM_DECKS_KEY,
  type CustomDeck,
  createCustomDeck,
  deleteCustomDeck,
  loadAllCustomDecks,
  loadCustomDecks,
  saveCustomDecks,
  updateCustomDeck,
} from './customDecks';

beforeEach(() => {
  localStorage.clear();
});

// ─── loadCustomDecks ──────────────────────────────────────────────────────────

describe('loadCustomDecks', () => {
  it('returns [] when storage is empty', () => {
    expect(loadCustomDecks()).toEqual([]);
  });

  it('returns [] when storage value is invalid JSON', () => {
    localStorage.setItem(CUSTOM_DECKS_KEY, 'not-json');
    expect(loadCustomDecks()).toEqual([]);
  });

  it('returns parsed decks from localStorage', () => {
    const decks: CustomDeck[] = [
      { id: 'abc', name: 'Week 1', wordKeys: ['καί', 'ὁ'], createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(decks));
    expect(loadCustomDecks()).toEqual(decks);
  });

  it('returns multiple decks in order', () => {
    const decks: CustomDeck[] = [
      { id: '1', name: 'A', wordKeys: [], createdAt: '2026-01-01T00:00:00.000Z' },
      { id: '2', name: 'B', wordKeys: ['καί'], createdAt: '2026-01-02T00:00:00.000Z' },
    ];
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(decks));
    expect(loadCustomDecks()).toEqual(decks);
  });
});

// ─── saveCustomDecks ──────────────────────────────────────────────────────────

describe('saveCustomDecks', () => {
  it('writes decks to the correct localStorage key', () => {
    const decks: CustomDeck[] = [
      { id: 'x', name: 'Test', wordKeys: ['εἰμί'], createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    saveCustomDecks(decks);
    expect(localStorage.getItem(CUSTOM_DECKS_KEY)).toBe(JSON.stringify(decks));
  });

  it('overwrites previous data', () => {
    const at = '2026-01-01T00:00:00.000Z';
    const first: CustomDeck[] = [{ id: '1', name: 'First', wordKeys: [], createdAt: at }];
    const second: CustomDeck[] = [{ id: '2', name: 'Second', wordKeys: ['καί'], createdAt: at }];
    saveCustomDecks(first);
    saveCustomDecks(second);
    expect(loadCustomDecks()).toEqual(second);
  });

  it('saves an empty array', () => {
    saveCustomDecks([]);
    expect(localStorage.getItem(CUSTOM_DECKS_KEY)).toBe('[]');
  });
});

// ─── createCustomDeck ─────────────────────────────────────────────────────────

describe('createCustomDeck', () => {
  it('returns a deck with a non-empty UUID id', () => {
    const deck = createCustomDeck('Week 1', ['καί']);
    expect(deck.id).toBeTruthy();
    expect(deck.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('stores the provided name (trimmed)', () => {
    const deck = createCustomDeck('  My Deck  ', ['καί']);
    expect(deck.name).toBe('My Deck');
  });

  it('stores the provided wordKeys', () => {
    const keys = ['καί', 'ὁ', 'εἰμί'];
    const deck = createCustomDeck('Deck', keys);
    // Sorted, so two devices that pick the same words hold the same deck.
    expect(deck.wordKeys).toEqual([...keys].sort());
  });

  it('sets createdAt to an ISO date string', () => {
    const before = new Date().toISOString();
    const deck = createCustomDeck('Deck', []);
    const after = new Date().toISOString();
    expect(deck.createdAt >= before).toBe(true);
    expect(deck.createdAt <= after).toBe(true);
  });

  it('appends to existing decks in localStorage', () => {
    const first = createCustomDeck('First', ['καί']);
    const second = createCustomDeck('Second', ['ὁ']);
    const stored = loadCustomDecks();
    expect(stored).toHaveLength(2);
    expect(stored[0].name).toBe('First');
    expect(stored[1].name).toBe('Second');
    // Return values match what was stored
    expect(stored[0].id).toBe(first.id);
    expect(stored[1].id).toBe(second.id);
  });

  it('persists to localStorage', () => {
    createCustomDeck('Persisted', ['καί']);
    expect(loadCustomDecks()).toHaveLength(1);
    expect(loadCustomDecks()[0].name).toBe('Persisted');
  });
});

// ─── updateCustomDeck ─────────────────────────────────────────────────────────

describe('updateCustomDeck', () => {
  it('updates the name of an existing deck', () => {
    const deck = createCustomDeck('Original', ['καί']);
    const result = updateCustomDeck(deck.id, { name: 'Renamed' });
    expect(result.find((d) => d.id === deck.id)?.name).toBe('Renamed');
  });

  it('trims whitespace from updated name', () => {
    const deck = createCustomDeck('Original', ['καί']);
    updateCustomDeck(deck.id, { name: '  Trimmed  ' });
    expect(loadCustomDecks().find((d) => d.id === deck.id)?.name).toBe('Trimmed');
  });

  it('updates wordKeys of an existing deck', () => {
    const deck = createCustomDeck('Deck', ['καί']);
    const newKeys = ['ὁ', 'εἰμί', 'λόγος'];
    updateCustomDeck(deck.id, { wordKeys: newKeys });
    expect(loadCustomDecks().find((d) => d.id === deck.id)?.wordKeys).toEqual([...newKeys].sort());
  });

  it('is a no-op for an unknown id', () => {
    createCustomDeck('Real', ['καί']);
    const result = updateCustomDeck('nonexistent-id', { name: 'Ghost' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Real');
  });

  it('does not affect other decks', () => {
    const d1 = createCustomDeck('Deck 1', ['καί']);
    const d2 = createCustomDeck('Deck 2', ['ὁ']);
    updateCustomDeck(d1.id, { name: 'Updated 1' });
    const stored = loadCustomDecks();
    expect(stored.find((d) => d.id === d2.id)?.name).toBe('Deck 2');
  });

  it('persists the update to localStorage', () => {
    const deck = createCustomDeck('Before', ['καί']);
    updateCustomDeck(deck.id, { name: 'After' });
    expect(loadCustomDecks().find((d) => d.id === deck.id)?.name).toBe('After');
  });

  it('returns the updated deck list', () => {
    const deck = createCustomDeck('Deck', ['καί']);
    const result = updateCustomDeck(deck.id, { name: 'NewName' });
    expect(result).toBeInstanceOf(Array);
    expect(result.find((d) => d.id === deck.id)?.name).toBe('NewName');
  });
});

// ─── deleteCustomDeck ─────────────────────────────────────────────────────────

describe('deleteCustomDeck', () => {
  it('removes the deck with the matching id', () => {
    const deck = createCustomDeck('ToDelete', ['καί']);
    const result = deleteCustomDeck(deck.id);
    expect(result).toHaveLength(0);
    expect(loadCustomDecks()).toHaveLength(0);
  });

  it('does not remove other decks', () => {
    const d1 = createCustomDeck('Keep', ['καί']);
    const d2 = createCustomDeck('Delete', ['ὁ']);
    deleteCustomDeck(d2.id);
    const stored = loadCustomDecks();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(d1.id);
  });

  it('is a no-op for an unknown id', () => {
    createCustomDeck('Deck', ['καί']);
    const result = deleteCustomDeck('nonexistent');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Deck');
  });

  it('persists the deletion to localStorage', () => {
    const deck = createCustomDeck('Deck', ['καί']);
    deleteCustomDeck(deck.id);
    expect(loadCustomDecks()).toHaveLength(0);
  });

  it('returns the updated deck list', () => {
    createCustomDeck('A', ['καί']);
    const d2 = createCustomDeck('B', ['ὁ']);
    const result = deleteCustomDeck(d2.id);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });
});

// ─── The shared module (#242) ─────────────────────────────────────────────────
//
// greek.tools stores its decks through @tools/shared/custom-decks. Decks saved
// before that have no update time, and must still read and merge.

describe('decks stored before the shared module', () => {
  const legacy = [
    { id: 'a1b2c3', name: 'Week 1', wordKeys: ['ὁ', 'καί'], createdAt: '2026-03-01T00:00:00.000Z' },
    { id: 'd4e5f6', name: 'Week 2', wordKeys: ['λόγος'], createdAt: '2026-03-08T00:00:00.000Z' },
  ];

  it('still load, with no update time and their words sorted', () => {
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(legacy));
    const decks = loadCustomDecks();
    expect(decks.map((d) => d.name)).toEqual(['Week 1', 'Week 2']);
    expect(decks.every((d) => d.updatedAt === undefined)).toBe(true);
    expect(decks[0].wordKeys).toEqual(['καί', 'ὁ']);
  });

  it('merge, the later change winning, as the shared sync does', () => {
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(legacy));
    const edited: SharedDeck = {
      ...parseDecks(legacy)[0],
      name: 'New name',
      updatedAt: '2026-04-01T00:00:00.000Z',
    };
    expect(mergeCustomDecks(loadCustomDecks(), [edited])[0].name).toBe('New name');
  });

  it('a deleted deck stays deleted when a device that still holds it syncs', () => {
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(legacy));
    deleteCustomDeck('a1b2c3');
    const merged = mergeCustomDecks(loadAllCustomDecks(), parseDecks(legacy));
    expect(merged.find((d) => d.id === 'a1b2c3')?.deletedAt).toBeDefined();
    expect(loadCustomDecks().map((d) => d.id)).toEqual(['d4e5f6']);
  });
});

describe('a deck built from the text records its source (#270)', () => {
  const ROM = { book: 'ROM', startChapter: 1, startVerse: 1, endChapter: 16, endVerse: 27 };

  it('is kept by create, and by an edit by hand', () => {
    const deck = createCustomDeck('Romans', ['πίστις'], ROM);
    expect(deck.source).toEqual(ROM);
    updateCustomDeck(deck.id, { name: 'Rom', wordKeys: ['πίστις', 'χάρις'] });
    expect(loadCustomDecks()[0].source).toEqual(ROM);
  });

  it('a hand-made deck has none', () => {
    expect(createCustomDeck('Mine', ['καί'])).not.toHaveProperty('source');
  });
});
