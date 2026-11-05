import type { CustomDeck } from '@tools/shared/custom-decks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SELECTION,
  effectiveSelection,
  loadSelection,
  normalizeSelection,
  saveSelection,
} from './deck-selection';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('normalizeSelection', () => {
  it('falls back to the default for anything that is not an object', () => {
    for (const input of [null, undefined, 'nope', 42, []]) {
      expect(normalizeSelection(input)).toEqual(DEFAULT_SELECTION);
    }
  });

  it('keeps a valid selection intact', () => {
    const input = {
      deck: 'garrett-derouchie',
      customDeckId: null,
      chapters: [1, 2, 3],
      categories: ['core', 'proper'],
    };
    expect(normalizeSelection(input)).toEqual(input);
  });

  it('rejects an unknown deck', () => {
    expect(normalizeSelection({ deck: 'pratico-van-pelt' }).deck).toBe('all');
  });

  it('sorts and de-duplicates chapters, dropping non-positive integers', () => {
    expect(normalizeSelection({ chapters: [3, 1, 1, 0, -2, 2.5, 'x', null] }).chapters).toEqual([
      1, 3,
    ]);
  });

  it('drops unknown categories', () => {
    expect(normalizeSelection({ categories: ['core', 'nonsense'] }).categories).toEqual(['core']);
  });

  it('returns categories in the canonical order, not the stored one', () => {
    // Order drives the chip row; a stored order would let it drift.
    expect(normalizeSelection({ categories: ['proper', 'core'] }).categories).toEqual([
      'core',
      'proper',
    ]);
  });

  it('never yields an empty category list', () => {
    // An empty list means an empty deck, which reads as a bug to the student.
    expect(normalizeSelection({ categories: [] }).categories).toEqual(['core']);
    expect(normalizeSelection({ categories: ['bogus'] }).categories).toEqual(['core']);
  });

  it('defaults a missing chapter list to "every chapter"', () => {
    expect(normalizeSelection({ deck: 'garrett-derouchie' }).chapters).toEqual([]);
  });
});

describe('loadSelection / saveSelection', () => {
  it('round-trips a selection', () => {
    const selection = {
      deck: 'garrett-derouchie' as const,
      customDeckId: null,
      chapters: [4, 5],
      categories: ['core' as const],
    };
    saveSelection(selection);
    expect(loadSelection()).toEqual(selection);
  });

  it('returns the default when nothing is stored', () => {
    expect(loadSelection()).toEqual(DEFAULT_SELECTION);
  });

  it('returns the default when the stored value is not JSON', () => {
    localStorage.setItem('hebrew-tools-deck-v1', '{{{');
    expect(loadSelection()).toEqual(DEFAULT_SELECTION);
  });

  it('normalizes a stored value written by an older build', () => {
    localStorage.setItem('hebrew-tools-deck-v1', JSON.stringify({ deck: 'garrett-derouchie:3' }));
    expect(loadSelection()).toEqual(DEFAULT_SELECTION);
  });

  it('survives a localStorage that throws on write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveSelection(DEFAULT_SELECTION)).not.toThrow();
  });

  it('survives a localStorage that throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadSelection()).toEqual(DEFAULT_SELECTION);
  });
});

describe('a custom deck in the selection', () => {
  it('keeps a custom deck that names itself', () => {
    expect(normalizeSelection({ deck: 'custom', customDeckId: 'd1' })).toMatchObject({
      deck: 'custom',
      customDeckId: 'd1',
    });
  });

  it('falls back to the whole vocabulary when no deck is named', () => {
    for (const customDeckId of [undefined, null, '', 7]) {
      expect(normalizeSelection({ deck: 'custom', customDeckId }).deck).toBe('all');
    }
  });

  it('forgets a deck id once another deck is chosen', () => {
    expect(normalizeSelection({ deck: 'all', customDeckId: 'd1' }).customDeckId).toBeNull();
  });

  it('round-trips through storage', () => {
    const selection = { ...DEFAULT_SELECTION, deck: 'custom' as const, customDeckId: 'd1' };
    saveSelection(selection);
    expect(loadSelection()).toEqual(selection);
  });

  describe('effectiveSelection', () => {
    const live: CustomDeck = {
      id: 'd1',
      name: 'Mine',
      wordKeys: ['a'],
      createdAt: '2026-11-01T00:00:00.000Z',
    };
    const gone: CustomDeck = { ...live, wordKeys: [], deletedAt: '2026-11-02T00:00:00.000Z' };
    const picked = { ...DEFAULT_SELECTION, deck: 'custom' as const, customDeckId: 'd1' };

    it('leaves a selection whose deck exists alone', () => {
      expect(effectiveSelection(picked, [live])).toBe(picked);
    });

    it('leaves a non-custom selection alone', () => {
      expect(effectiveSelection(DEFAULT_SELECTION, [])).toBe(DEFAULT_SELECTION);
    });

    it('falls back to the whole vocabulary when the deck was deleted or never arrived', () => {
      expect(effectiveSelection(picked, [gone])).toMatchObject({ deck: 'all', customDeckId: null });
      expect(effectiveSelection(picked, [])).toMatchObject({ deck: 'all', customDeckId: null });
    });
  });
});
