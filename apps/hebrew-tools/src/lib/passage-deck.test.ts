import { MAX_DECK_NAME } from '@tools/shared/custom-decks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { customDeckStore } from './custom-decks';
import { DEFAULT_SELECTION, loadSelection, saveSelection } from './deck-selection';
import { passageDeckName, saveStudyDeck } from './passage-deck';

beforeEach(() => localStorage.clear());

describe('passageDeckName', () => {
  it('prefixes the title, so it cannot collide with a deck the student named', () => {
    expect(passageDeckName(' Genesis 1:1–5 ')).toBe('Passage: Genesis 1:1–5');
  });

  it('fits the deck name limit', () => {
    const name = passageDeckName('x'.repeat(200));
    expect(name.length).toBeLessThanOrEqual(MAX_DECK_NAME);
    expect(name.startsWith('Passage: x')).toBe(true);
  });
});

describe('saveStudyDeck', () => {
  it('saves the words as a deck and makes it the selection the flashcards open on', () => {
    const id = saveStudyDeck('Genesis 1:1–5', ['b', 'a']);
    expect(customDeckStore.load()).toMatchObject([
      { id, name: 'Passage: Genesis 1:1–5', wordKeys: ['a', 'b'] },
    ]);
    expect(loadSelection()).toMatchObject({ deck: 'custom', customDeckId: id });
  });

  it('updates the passage’s deck instead of stacking a second one', () => {
    const first = saveStudyDeck('Genesis 1:1–5', ['a']);
    const second = saveStudyDeck('Genesis 1:1–5', ['a', 'c']);
    expect(second).toBe(first);
    expect(customDeckStore.load()).toHaveLength(1);
    expect(customDeckStore.load()[0].wordKeys).toEqual(['a', 'c']);
  });

  it('gives each passage its own deck', () => {
    saveStudyDeck('Genesis 1:1–5', ['a']);
    saveStudyDeck('Psalm 23', ['b']);
    expect(customDeckStore.load().map((d) => d.name)).toEqual([
      'Passage: Genesis 1:1–5',
      'Passage: Psalm 23',
    ]);
  });

  it('keeps the rest of what the student had picked, and does not touch a deck they named themselves', () => {
    const own = customDeckStore.create('Passage', ['z']);
    saveSelection({ ...DEFAULT_SELECTION, chapters: [2, 3], categories: ['core', 'reading'] });
    saveStudyDeck('Genesis 1:1–5', ['a']);
    expect(loadSelection()).toMatchObject({ chapters: [2, 3] });
    expect(customDeckStore.load().find((d) => d.id === own.id)?.wordKeys).toEqual(['z']);
  });

  it('writes nothing when storage is full', () => {
    const full = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => saveStudyDeck('Genesis 1:1–5', ['a'])).toThrow('full');
    full.mockRestore();
    expect(customDeckStore.load()).toEqual([]);
  });
});
