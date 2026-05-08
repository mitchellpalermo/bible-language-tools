import { beforeEach, describe, expect, it } from 'vitest';
import {
  CUSTOM_DECKS_KEY,
  type CustomDeck,
  createCustomDeck,
  deleteCustomDeck,
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
    const first: CustomDeck[] = [{ id: '1', name: 'First', wordKeys: [], createdAt: '' }];
    const second: CustomDeck[] = [{ id: '2', name: 'Second', wordKeys: ['καί'], createdAt: '' }];
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
    expect(deck.wordKeys).toEqual(keys);
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
    expect(loadCustomDecks().find((d) => d.id === deck.id)?.wordKeys).toEqual(newKeys);
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
