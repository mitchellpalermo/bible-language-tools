import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CustomDeck,
  createCustomDeckStore,
  deckFromRow,
  deckNameError,
  deckRestartPart,
  findDeck,
  isLive,
  MAX_DECK_NAME,
  MAX_DECK_WORDS,
  MAX_DECKS,
  mergeCustomDecks,
  parseDeck,
  parseDeckList,
  parseDecks,
  pruneTombstones,
  rowFromDeck,
  stampOf,
  TOMBSTONE_TTL_DAYS,
  wordsInDeck,
} from './custom-decks';

const KEY = 'test-decks-v1';
const NOW = new Date('2026-11-05T12:00:00.000Z');

function deck(over: Partial<CustomDeck> = {}): CustomDeck {
  return {
    id: 'd1',
    name: 'Genesis 1',
    wordKeys: ['a', 'b'],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...over,
  };
}

const tomb = (over: Partial<CustomDeck> = {}) =>
  deck({
    wordKeys: [],
    updatedAt: '2026-11-03T00:00:00.000Z',
    deletedAt: '2026-11-03T00:00:00.000Z',
    ...over,
  });

beforeEach(() => localStorage.clear());

describe('parseDeck', () => {
  it('accepts a deck and sorts and de-duplicates its words', () => {
    expect(parseDeck(deck({ wordKeys: ['b', 'a', 'b'] }))?.wordKeys).toEqual(['a', 'b']);
  });

  it('accepts a deck that predates sync, with no updatedAt', () => {
    const { updatedAt: _omit, ...legacy } = deck();
    const parsed = parseDeck(legacy);
    expect(parsed).not.toBeNull();
    expect(parsed?.updatedAt).toBeUndefined();
    expect(stampOf(parsed as CustomDeck)).toBe(legacy.createdAt);
  });

  it('empties a tombstone', () => {
    const parsed = parseDeck(tomb({ wordKeys: ['x'] }));
    expect(parsed?.wordKeys).toEqual([]);
    expect(isLive(parsed as CustomDeck)).toBe(false);
  });

  it.each([
    ['not an object', 'deck'],
    ['null', null],
    ['an array', []],
    ['no id', { ...deck(), id: undefined }],
    ['an empty id', deck({ id: '' })],
    ['a long id', deck({ id: 'x'.repeat(101) })],
    ['a long name', deck({ name: 'x'.repeat(MAX_DECK_NAME + 1) })],
    ['a numeric name', { ...deck(), name: 5 }],
    ['a bad createdAt', deck({ createdAt: 'yesterday' })],
    ['a bad updatedAt', deck({ updatedAt: 'later' })],
    ['a bad deletedAt', deck({ deletedAt: 'never' })],
    ['words not an array', { ...deck(), wordKeys: 'ab' }],
    [
      'too many words',
      deck({ wordKeys: Array.from({ length: MAX_DECK_WORDS + 1 }, (_, i) => `${i}`) }),
    ],
    ['a non-string word', { ...deck(), wordKeys: ['a', 3] }],
    ['an empty word', deck({ wordKeys: [''] })],
    ['a long word', deck({ wordKeys: ['x'.repeat(201)] })],
  ])('rejects %s', (_label, input) => {
    expect(parseDeck(input)).toBeNull();
  });
});

describe('parseDecks and parseDeckList', () => {
  it('parseDecks drops what is not a deck and repeated ids', () => {
    expect(parseDecks([deck(), 'junk', deck({ name: 'dup' }), deck({ id: 'd2' })])).toHaveLength(2);
    expect(parseDecks('nope')).toEqual([]);
  });

  it('parseDeckList is all or nothing', () => {
    expect(parseDeckList([deck(), deck({ id: 'd2' })])).toHaveLength(2);
    expect(parseDeckList([deck(), 'junk'])).toBeNull();
    expect(parseDeckList([deck(), deck()])).toBeNull();
    expect(parseDeckList('nope')).toBeNull();
    expect(
      parseDeckList(Array.from({ length: MAX_DECKS + 1 }, (_, i) => deck({ id: `d${i}` }))),
    ).toBeNull();
  });
});

describe('mergeCustomDecks', () => {
  it('unions decks by id', () => {
    const merged = mergeCustomDecks([deck()], [deck({ id: 'd2', name: 'Two' })], NOW);
    expect(merged.map((d) => d.id)).toEqual(['d1', 'd2']);
  });

  it('keeps the later edit, whole', () => {
    const older = deck({ name: 'Old', wordKeys: ['a'] });
    const newer = deck({
      name: 'New',
      wordKeys: ['a', 'b', 'c'],
      updatedAt: '2026-11-02T00:00:00.000Z',
    });
    expect(mergeCustomDecks([older], [newer], NOW)).toEqual([newer]);
    expect(mergeCustomDecks([newer], [older], NOW)).toEqual([newer]);
  });

  it('lets createdAt stand in for a missing updatedAt', () => {
    const { updatedAt: _omit, ...legacy } = deck({ name: 'Legacy' });
    const edited = deck({ name: 'Edited', updatedAt: '2026-11-02T00:00:00.000Z' });
    expect(mergeCustomDecks([legacy], [edited], NOW)[0].name).toBe('Edited');
  });

  it('a deletion survives a stale device that still holds the deck', () => {
    const merged = mergeCustomDecks([deck()], [tomb()], NOW);
    expect(merged).toHaveLength(1);
    expect(isLive(merged[0])).toBe(false);
    expect(mergeCustomDecks([tomb()], [deck()], NOW)).toEqual(merged);
  });

  it('an edit after a deletion brings the deck back', () => {
    const later = deck({ updatedAt: '2026-11-04T00:00:00.000Z' });
    expect(isLive(mergeCustomDecks([tomb()], [later], NOW)[0])).toBe(true);
  });

  it('a deletion beats an edit made at the same moment, from either side', () => {
    const edit = deck({ updatedAt: '2026-11-03T00:00:00.000Z' });
    expect(isLive(mergeCustomDecks([edit], [tomb()], NOW)[0])).toBe(false);
    expect(isLive(mergeCustomDecks([tomb()], [edit], NOW)[0])).toBe(false);
  });

  it('is symmetric when two edits tie', () => {
    const x = deck({ name: 'X' });
    const y = deck({ name: 'Y' });
    expect(mergeCustomDecks([x], [y], NOW)).toEqual(mergeCustomDecks([y], [x], NOW));
  });

  it('returns the same order from either side', () => {
    const a = [deck({ id: 'b', createdAt: '2026-11-02T00:00:00.000Z' })];
    const b = [deck({ id: 'a', createdAt: '2026-11-02T00:00:00.000Z' }), deck({ id: 'c' })];
    const ids = mergeCustomDecks(a, b, NOW).map((d) => d.id);
    expect(ids).toEqual(['c', 'a', 'b']);
    expect(mergeCustomDecks(b, a, NOW).map((d) => d.id)).toEqual(ids);
  });

  it('is idempotent', () => {
    const once = mergeCustomDecks([deck(), tomb({ id: 'd2' })], [deck({ id: 'd3' })], NOW);
    expect(mergeCustomDecks(once, once, NOW)).toEqual(once);
  });
});

describe('pruneTombstones', () => {
  const day = 86_400_000;
  it('drops a tombstone past the TTL and keeps a recent one and every live deck', () => {
    const old = new Date(NOW.getTime() - (TOMBSTONE_TTL_DAYS + 1) * day).toISOString();
    const recent = new Date(NOW.getTime() - (TOMBSTONE_TTL_DAYS - 1) * day).toISOString();
    const kept = pruneTombstones(
      [
        tomb({ id: 'old', deletedAt: old, updatedAt: old }),
        tomb({ id: 'recent', deletedAt: recent, updatedAt: recent }),
        deck({ id: 'live', createdAt: old, updatedAt: old }),
      ],
      NOW,
    );
    expect(kept.map((d) => d.id)).toEqual(['recent', 'live']);
  });

  it('defaults to the current time', () => {
    expect(pruneTombstones([tomb({ deletedAt: new Date().toISOString() })])).toHaveLength(1);
  });
});

describe('deckNameError', () => {
  const decks = [deck(), tomb({ id: 'gone', name: 'Deleted one' })];
  it('requires a name', () => expect(deckNameError('   ', decks)).toMatch(/required/));
  it('caps the length', () =>
    expect(deckNameError('x'.repeat(MAX_DECK_NAME + 1), decks)).toMatch(/60 characters/));
  it('refuses a live duplicate, ignoring case and spacing', () =>
    expect(deckNameError('  genesis 1 ', decks)).toMatch(/already exists/));
  it('lets a deck keep its own name', () =>
    expect(deckNameError('Genesis 1', decks, 'd1')).toBeNull());
  it('lets a deleted deck’s name be reused', () =>
    expect(deckNameError('Deleted one', decks)).toBeNull());
  it('accepts a fresh name', () => expect(deckNameError('Psalms', decks)).toBeNull());
});

describe('selection', () => {
  const words = [{ k: 'c' }, { k: 'a' }, { k: 'z' }, { k: 'b' }];
  it('findDeck returns only a live deck that exists', () => {
    const decks = [deck(), tomb({ id: 'gone' })];
    expect(findDeck(decks, 'd1')?.id).toBe('d1');
    expect(findDeck(decks, 'gone')).toBeNull();
    expect(findDeck(decks, 'nope')).toBeNull();
    expect(findDeck(decks, null)).toBeNull();
  });

  it('wordsInDeck keeps the vocabulary order and skips keys the vocabulary lacks', () => {
    const d = deck({ wordKeys: ['b', 'c', 'missing'] });
    expect(wordsInDeck(d, words, (w) => w.k).map((w) => w.k)).toEqual(['c', 'b']);
    expect(wordsInDeck(null, words, (w) => w.k)).toEqual([]);
  });

  it('the restart part ignores the name and follows the words', () => {
    const a = deck({ wordKeys: ['b', 'a'] });
    expect(deckRestartPart(a)).toEqual(deckRestartPart({ ...a, name: 'Renamed' }));
    expect(deckRestartPart(a)).not.toEqual(deckRestartPart({ ...a, wordKeys: ['a'] }));
    expect(deckRestartPart(a)).toEqual(['d1', ['a', 'b']]);
    expect(deckRestartPart(null)).toEqual([null, []]);
  });
});

describe('createCustomDeckStore', () => {
  let tick = 0;
  const clock = () => new Date(Date.UTC(2026, 10, 5, 12, 0, tick++));
  const store = () => createCustomDeckStore(KEY, clock);
  beforeEach(() => {
    tick = 0;
  });

  it('starts empty and survives corrupt storage', () => {
    expect(store().load()).toEqual([]);
    localStorage.setItem(KEY, '{not json');
    expect(store().loadAll()).toEqual([]);
  });

  it('creates a deck with trimmed name, sorted unique words and both stamps', () => {
    const s = store();
    const created = s.create('  My deck ', ['b', 'a', 'b']);
    expect(created).toMatchObject({ name: 'My deck', wordKeys: ['a', 'b'] });
    expect(created.updatedAt).toBe(created.createdAt);
    expect(s.load()).toEqual([created]);
  });

  it('updates the name and words, stamping the edit', () => {
    const s = store();
    const { id, createdAt } = s.create('One', ['a']);
    const [updated] = s.update(id, { name: ' Two ', wordKeys: ['z', 'y'] });
    expect(updated).toMatchObject({ name: 'Two', wordKeys: ['y', 'z'], createdAt });
    expect(updated.updatedAt).not.toBe(createdAt);
  });

  it('updates one field and leaves the other', () => {
    const s = store();
    const { id } = s.create('One', ['a']);
    expect(s.update(id, { name: 'Two' })[0]).toMatchObject({ name: 'Two', wordKeys: ['a'] });
    expect(s.update(id, { wordKeys: ['b'] })[0]).toMatchObject({ name: 'Two', wordKeys: ['b'] });
  });

  it('removing leaves a tombstone that sync can see and the UI cannot', () => {
    const s = store();
    const { id } = s.create('One', ['a']);
    s.create('Two', ['b']);
    expect(s.remove(id).map((d) => d.name)).toEqual(['Two']);
    const stored = s.loadAll().find((d) => d.id === id) as CustomDeck;
    expect(isLive(stored)).toBe(false);
    expect(stored.wordKeys).toEqual([]);
    expect(stored.deletedAt).toBe(stored.updatedAt);
  });

  it('does not edit or re-delete a tombstone, nor touch an unknown id', () => {
    const s = store();
    const { id } = s.create('One', ['a']);
    s.remove(id);
    const before = JSON.stringify(s.loadAll());
    s.update(id, { name: 'Back' });
    s.remove(id);
    s.update('unknown', { name: 'x' });
    expect(JSON.stringify(s.loadAll())).toBe(before);
  });

  it('keeps each key to itself', () => {
    store().create('Mine', ['a']);
    expect(createCustomDeckStore('other-key').load()).toEqual([]);
  });

  it('saveAll replaces and throws when storage does', () => {
    const s = store();
    s.saveAll([deck()]);
    expect(s.load()).toHaveLength(1);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => s.create('x', ['a'])).toThrow('quota');
    spy.mockRestore();
  });

  it('uses the real clock by default', () => {
    const created = createCustomDeckStore(KEY).create('Now', ['a']);
    expect(Math.abs(Date.parse(created.createdAt) - Date.now())).toBeLessThan(5000);
  });
});

// ─── A deck's source (#267, #270) ────────────────────────────────────────────

describe('a deck built from the text records its source', () => {
  const GAL = { book: 'GAL', startChapter: 1, startVerse: 1, endChapter: 6, endVerse: 18 };
  const PASSAGE = { book: 'GAL', startChapter: 1, startVerse: 11, endChapter: 2, endVerse: 21 };

  it('parseDeck round-trips a source', () => {
    expect(parseDeck(deck({ source: GAL }))?.source).toEqual(GAL);
  });

  it('a deck without one still parses, and a null column reads as none', () => {
    expect(parseDeck(deck())).not.toHaveProperty('source');
    expect(parseDeck({ ...deck(), source: null })).not.toHaveProperty('source');
  });

  it('rejects a deck whose source is not a range', () => {
    expect(parseDeck({ ...deck(), source: 'GAL' })).toBeNull();
    expect(parseDeck(deck({ source: { ...GAL, endChapter: 0 } }))).toBeNull();
    expect(parseDeck(deck({ source: { ...PASSAGE, endChapter: 1, endVerse: 1 } }))).toBeNull();
    expect(parseDeck({ ...deck(), source: { ...GAL, book: 7 } })).toBeNull();
  });

  it('a tombstone carries no source', () => {
    expect(parseDeck(tomb({ source: GAL }))).not.toHaveProperty('source');
  });

  it('an old client’s copy at the same moment does not erase it, from either side', () => {
    const sourced = deck({ source: GAL });
    const stale = deck();
    expect(mergeCustomDecks([sourced], [stale], NOW)[0].source).toEqual(GAL);
    expect(mergeCustomDecks([stale], [sourced], NOW)[0].source).toEqual(GAL);
  });

  it('nor does a later edit from an old client, which keeps the words it changed', () => {
    const renamed = deck({ name: 'Gal', updatedAt: '2026-11-04T00:00:00.000Z' });
    const [merged] = mergeCustomDecks([deck({ source: GAL })], [renamed], NOW);
    expect(merged).toMatchObject({ name: 'Gal', source: GAL });
  });

  it('a rebuild’s new source wins over the old one, from either side', () => {
    const old = deck({ source: PASSAGE });
    const rebuilt = deck({ source: GAL, updatedAt: '2026-11-04T00:00:00.000Z' });
    expect(mergeCustomDecks([old], [rebuilt], NOW)[0].source).toEqual(GAL);
    expect(mergeCustomDecks([rebuilt], [old], NOW)[0].source).toEqual(GAL);
  });

  it('a deletion does not pick a source back up', () => {
    expect(mergeCustomDecks([deck({ source: GAL })], [tomb()], NOW)[0]).not.toHaveProperty(
      'source',
    );
  });

  describe('in the store', () => {
    let store: ReturnType<typeof createCustomDeckStore>;
    beforeEach(() => {
      localStorage.clear();
      store = createCustomDeckStore(KEY, () => NOW);
    });

    it('create keeps the source; a deck made by hand has none', () => {
      expect(store.create('Galatians', ['a'], GAL).source).toEqual(GAL);
      expect(store.create('Mine', ['a'])).not.toHaveProperty('source');
      expect(store.load()[0].source).toEqual(GAL);
    });

    it('editing by hand keeps it; a rebuild replaces it; deleting drops it', () => {
      const { id } = store.create('Galatians', ['a'], GAL);
      expect(store.update(id, { name: 'Gal', wordKeys: ['a', 'z'] })[0].source).toEqual(GAL);
      expect(store.update(id, { source: PASSAGE })[0].source).toEqual(PASSAGE);
      store.remove(id);
      expect(store.loadAll()[0]).not.toHaveProperty('source');
    });
  });
});

describe('the database row', () => {
  const GAL = { book: 'GAL', startChapter: 1, startVerse: 1, endChapter: 6, endVerse: 18 };

  it('round-trips a deck with and without a source', () => {
    for (const d of [deck(), deck({ source: GAL }), tomb()]) {
      expect(parseDeck(deckFromRow(rowFromDeck(d)))).toEqual(parseDeck(d));
    }
  });

  it('reads a row written before 0005 and 0007', () => {
    const row = { ...rowFromDeck(deck()), updatedAt: '', source: null };
    expect(parseDeck(deckFromRow(row))).toEqual({
      id: 'd1',
      name: 'Genesis 1',
      wordKeys: ['a', 'b'],
      createdAt: '2026-11-01T00:00:00.000Z',
    });
  });

  it('a damaged column costs the deck its words or its source, never the deck', () => {
    const row = { ...rowFromDeck(deck({ source: GAL })), wordKeys: '[', source: '{' };
    expect(parseDeck(deckFromRow(row))).toMatchObject({ id: 'd1', wordKeys: [] });
    expect(parseDeck(deckFromRow({ ...row, source: '{"book":"GAL"}' }))).not.toHaveProperty(
      'source',
    );
  });
});
