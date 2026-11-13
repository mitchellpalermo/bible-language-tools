import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomDeck } from './custom-decks';
import { createDeckSelection, effectiveSelection, selectedTextbook } from './deck-selection';

type Book = 'primer' | 'reader';
type Category = 'core' | 'names' | 'extra';

const KEY = 'test-deck-v1';
const BOOKS: Book[] = ['primer', 'reader'];

const model = createDeckSelection<Book, Category>({
  storageKey: KEY,
  textbookIds: BOOKS,
  categoryIds: ['core', 'names', 'extra'],
  defaultCategories: ['core'],
});
const { defaultSelection, normalizeSelection, loadSelection, saveSelection } = model;

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('normalizeSelection', () => {
  it('falls back to the default for anything that is not an object', () => {
    for (const input of [null, undefined, 'nope', 42, []]) {
      expect(normalizeSelection(input)).toEqual(defaultSelection);
    }
  });

  it('keeps a valid selection intact', () => {
    const input = { deck: 'reader', customDeckId: null, chapters: [1, 2], categories: ['names'] };
    expect(normalizeSelection(input)).toEqual(input);
  });

  it('reads a deck that is not in the textbook list as the whole vocabulary', () => {
    expect(normalizeSelection({ deck: 'some-other-book' }).deck).toBe('all');
  });

  it('keeps a custom deck only with its id', () => {
    expect(normalizeSelection({ deck: 'custom', customDeckId: 'd1' })).toMatchObject({
      deck: 'custom',
      customDeckId: 'd1',
    });
    expect(normalizeSelection({ deck: 'custom' }).deck).toBe('all');
    expect(normalizeSelection({ deck: 'custom', customDeckId: '' }).deck).toBe('all');
  });

  it('drops a custom deck id from any other deck', () => {
    expect(normalizeSelection({ deck: 'primer', customDeckId: 'd1' }).customDeckId).toBeNull();
  });

  it('sorts and de-duplicates chapters, dropping what is not a positive integer', () => {
    expect(normalizeSelection({ chapters: [3, 1, 1, 0, -2, 2.5, 'x', null] }).chapters).toEqual([
      1, 3,
    ]);
    expect(normalizeSelection({ chapters: 'all' }).chapters).toEqual([]);
  });

  it('returns known categories in the canonical order', () => {
    expect(normalizeSelection({ categories: ['extra', 'bogus', 'core'] }).categories).toEqual([
      'core',
      'extra',
    ]);
  });

  it('never yields an empty category list', () => {
    expect(normalizeSelection({ categories: [] }).categories).toEqual(['core']);
    expect(normalizeSelection({ categories: ['bogus'] }).categories).toEqual(['core']);
    expect(normalizeSelection({ categories: 'core' }).categories).toEqual(['core']);
  });
});

describe('storage', () => {
  it('loads the default when nothing is stored', () => {
    expect(loadSelection()).toEqual(defaultSelection);
  });

  it('hands back a copy, so a caller cannot change the default', () => {
    loadSelection().categories.push('names');
    expect(loadSelection().categories).toEqual(['core']);
  });

  it('round-trips a selection under its own key', () => {
    const selection = normalizeSelection({ deck: 'primer', chapters: [2, 3] });
    saveSelection(selection);
    expect(loadSelection()).toEqual(selection);
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it('does not read another binding’s key', () => {
    const other = createDeckSelection<Book, Category>({
      storageKey: 'other-deck-v1',
      textbookIds: BOOKS,
      categoryIds: ['core'],
      defaultCategories: ['core'],
    });
    other.saveSelection(normalizeSelection({ deck: 'reader' }));
    expect(loadSelection().deck).toBe('all');
  });

  it('normalizes what it reads', () => {
    localStorage.setItem(KEY, JSON.stringify({ deck: 'gone', chapters: [2, 2] }));
    expect(loadSelection()).toEqual({ ...defaultSelection, chapters: [2] });
  });

  it('loads the default when the stored value is not JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadSelection()).toEqual(defaultSelection);
  });

  it('survives storage that cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveSelection(defaultSelection)).not.toThrow();
  });
});

describe('effectiveSelection', () => {
  const deck = (id: string, deleted = false): CustomDeck => ({
    id,
    name: id,
    wordKeys: deleted ? [] : ['a'],
    createdAt: '2026-11-01T00:00:00.000Z',
    ...(deleted ? { deletedAt: '2026-11-02T00:00:00.000Z' } : {}),
  });
  const custom = normalizeSelection({ deck: 'custom', customDeckId: 'd1', chapters: [4] });

  it('leaves a textbook or whole-vocabulary selection alone', () => {
    const primer = normalizeSelection({ deck: 'primer' });
    expect(effectiveSelection(primer, [])).toBe(primer);
    expect(effectiveSelection(defaultSelection, [])).toBe(defaultSelection);
  });

  it('keeps a custom deck that still exists', () => {
    expect(effectiveSelection(custom, [deck('d1')])).toBe(custom);
  });

  it('falls back to the whole vocabulary when the deck is gone or deleted', () => {
    const gone = { ...custom, deck: 'all', customDeckId: null };
    expect(effectiveSelection(custom, [])).toEqual(gone);
    expect(effectiveSelection(custom, [deck('d1', true)])).toEqual(gone);
  });
});

describe('selectedTextbook', () => {
  it('is the textbook, or null for the whole vocabulary or a custom deck', () => {
    expect(selectedTextbook(normalizeSelection({ deck: 'reader' }), BOOKS)).toBe('reader');
    expect(selectedTextbook(defaultSelection, BOOKS)).toBeNull();
    expect(
      selectedTextbook(normalizeSelection({ deck: 'custom', customDeckId: 'd1' }), BOOKS),
    ).toBeNull();
  });
});
