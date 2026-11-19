import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DeckSource } from './custom-decks';
import { sourceKey, useDeckSource } from './use-deck-source';

const GAL: DeckSource = { book: 'GAL', startChapter: 1, startVerse: 1, endChapter: 2, endVerse: 1 };
const PHM: DeckSource = { book: 'PHM', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 1 };
const keysOf = (w: string) => [w];

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('sourceKey', () => {
  it('names a range and nothing else', () => {
    expect(sourceKey(GAL)).toBe('GAL 1:1-2:1');
    expect(sourceKey(null)).toBeNull();
  });
});

describe('useDeckSource', () => {
  it('loads nothing without a source', () => {
    const load = vi.fn();
    const { result } = renderHook(() => useDeckSource(null, load));
    expect(result.current).toEqual({ text: null, loading: false });
    expect(load).not.toHaveBeenCalled();
  });

  it('indexes the book it loads', async () => {
    const load = vi.fn(async () => ({
      book: { '1': { '1': ['a'] }, '2': { '1': ['b'] } },
      keysOf,
    }));
    const { result } = renderHook(() => useDeckSource(GAL, load));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.text).not.toBeNull());
    expect(result.current.loading).toBe(false);
    expect(load).toHaveBeenCalledWith('GAL');
    expect(result.current.text?.index.chaptersOf('b')).toEqual([2]);
  });

  it('never hands back a superseded book, even when it lands last', async () => {
    const gal = deferred<{
      book: Record<string, Record<string, string[]>>;
      keysOf: typeof keysOf;
    }>();
    const phm = deferred<{
      book: Record<string, Record<string, string[]>>;
      keysOf: typeof keysOf;
    }>();
    const load = vi.fn((code: string) => (code === 'GAL' ? gal.promise : phm.promise));
    const { result, rerender } = renderHook(({ s }) => useDeckSource(s, load), {
      initialProps: { s: GAL },
    });
    rerender({ s: PHM });
    await act(async () => phm.resolve({ book: { '1': { '1': ['philemon'] } }, keysOf }));
    await act(async () => gal.resolve({ book: { '1': { '1': ['galatians'] } }, keysOf }));
    expect(result.current.text?.index.range.book).toBe('PHM');
    expect(result.current.text?.index.occurrencesOf('galatians')).toEqual([]);
  });

  it('reads nothing of the old source while the new one loads', async () => {
    const load = vi.fn(async (code: string) => ({ book: { '1': { '1': [code] } }, keysOf }));
    const { result, rerender } = renderHook(({ s }) => useDeckSource(s, load), {
      initialProps: { s: GAL },
    });
    await waitFor(() => expect(result.current.text).not.toBeNull());
    rerender({ s: PHM });
    expect(result.current).toEqual({ text: null, loading: true });
  });

  it('a failed load leaves no text and does not throw', async () => {
    const failed = deferred<never>();
    const { result } = renderHook(() => useDeckSource(GAL, () => failed.promise));
    await act(async () => failed.reject(new Error('offline')));
    expect(result.current).toEqual({ text: null, loading: false });
  });
});
