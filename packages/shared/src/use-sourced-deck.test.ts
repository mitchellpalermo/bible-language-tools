import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CustomDeck } from './custom-decks';
import { createDeckChapterMemory } from './deck-source';
import { useSourcedDeck } from './use-sourced-deck';

const BOOK = {
  '1': { '1': ['a', 'b'], '2': ['c'] },
  '2': { '1': ['b', 'd'] },
  '3': { '1': ['e'] },
};
const keysOf = (w: string) => [w];
const load = async () => ({ book: BOOK, keysOf });
const failing = () => Promise.reject(new Error('offline'));
const memory = createDeckChapterMemory('test-deck-chapters');
const id = (w: string) => w;

function deck(over: Partial<CustomDeck> = {}): CustomDeck {
  return {
    id: 'rom',
    name: 'Romans',
    wordKeys: ['a', 'b', 'c', 'd', 'e', 'mine'],
    createdAt: '2026-11-01T00:00:00.000Z',
    source: { book: 'ROM', startChapter: 1, startVerse: 1, endChapter: 3, endVerse: 1 },
    ...over,
  };
}
const WORDS = ['a', 'b', 'c', 'd', 'e', 'mine'];

beforeEach(() => localStorage.clear());

describe('useSourcedDeck', () => {
  it('offers each chapter with its count and narrows to the chosen ones', async () => {
    const { result } = renderHook(() => useSourcedDeck(deck(), load, memory));
    await waitFor(() => expect(result.current.pickerChapters).not.toBeNull());
    expect(result.current.pickerChapters).toEqual([
      { chapter: 1, total: 3 },
      { chapter: 2, total: 2 },
      { chapter: 3, total: 1 },
    ]);
    expect(result.current.narrow(WORDS, id)).toEqual(WORDS);
    act(() => result.current.setChapters([2]));
    // b is in chapters 1 and 2: every chapter it occurs in. "mine" is in none.
    expect(result.current.narrow(WORDS, id)).toEqual(['b', 'd']);
    expect(result.current.restartPart).toEqual([[2], false]);
  });

  it('remembers chapters per deck, on this browser', async () => {
    const first = renderHook(({ d }) => useSourcedDeck(d, load, memory), {
      initialProps: { d: deck() },
    });
    await waitFor(() => expect(first.result.current.text).not.toBeNull());
    act(() => first.result.current.setChapters([3]));
    first.rerender({ d: deck({ id: 'gal' }) });
    expect(first.result.current.chapters).toEqual([]);
    first.rerender({ d: deck() });
    expect(first.result.current.chapters).toEqual([3]);
    expect(memory.load()).toEqual({ rom: [3] });
  });

  it('deals nothing while chosen chapters wait on the text, then the chapters', async () => {
    memory.save({ rom: [1] });
    const { result } = renderHook(() => useSourcedDeck(deck(), load, memory));
    expect(result.current.pending).toBe(true);
    expect(result.current.narrow(WORDS, id)).toEqual([]);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.narrow(WORDS, id)).toEqual(['a', 'b', 'c']);
  });

  it('a failed load studies the whole deck with no picker', async () => {
    memory.save({ rom: [1] });
    const { result } = renderHook(() => useSourcedDeck(deck(), failing, memory));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.pickerChapters).toBeNull();
    expect(result.current.narrow(WORDS, id)).toEqual(WORDS);
    expect(result.current.occurrencesOf('a')).toEqual([]);
  });

  it('a deck with no source, or one chapter, has no picker and ignores stored chapters', async () => {
    memory.save({ rom: [1] });
    const none = renderHook(() => useSourcedDeck(deck({ source: undefined }), load, memory));
    expect(none.result.current.chapters).toEqual([]);
    expect(none.result.current.pickerChapters).toBeNull();
    const single = deck({
      source: { book: 'ROM', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 2 },
    });
    const one = renderHook(() => useSourcedDeck(single, load, memory));
    await waitFor(() => expect(one.result.current.text).not.toBeNull());
    expect(one.result.current.pickerChapters).toBeNull();
    expect(one.result.current.narrow(WORDS, id)).toEqual(WORDS);
    // The verse still has the text.
    expect(one.result.current.occurrencesOf('c')).toEqual([{ chapter: 1, verse: 2, position: 0 }]);
  });

  it('drops a stored chapter the text does not have', async () => {
    memory.save({ rom: [2, 9] });
    const { result } = renderHook(() => useSourcedDeck(deck(), load, memory));
    await waitFor(() => expect(result.current.text).not.toBeNull());
    expect(result.current.chapters).toEqual([2]);
  });

  it('with no deck, does nothing', () => {
    const { result } = renderHook(() => useSourcedDeck(null, load, memory));
    act(() => result.current.setChapters([1]));
    expect(memory.load()).toEqual({});
    expect(result.current.narrow(WORDS, id)).toEqual(WORDS);
  });
});
