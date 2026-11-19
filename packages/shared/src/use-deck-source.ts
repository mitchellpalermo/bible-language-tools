// Load a deck's source text and index it, for the chapter picker (#270) and the
// verse on reveal (#267). Language-agnostic: the app passes `load`, which
// fetches the book (both apps' `fetchBook` cache per book) and says which SRS
// keys a word of it is an occurrence of.
//
// Two rules from greek.tools' CLAUDE.md, "Loading book data in a component":
// a superseded response must not land last (the `cancelled` flag), and data
// loaded for one source must not be read while another's is loading (the
// result is paired with the source it was built for, and handed back only
// while they match). Books differ fiftyfold in size, so both happen.
//
// The book is fetched when a sourced deck is picked, never on page load, and
// a fetch that fails leaves the deck working exactly as a deck with no source.

import { useEffect, useState } from 'react';
import type { DeckSource } from './custom-decks';
import { buildDeckSourceIndex, type DeckSourceIndex } from './deck-source';
import type { VerseBook } from './focus-passages';

export interface LoadedSource<W> {
  book: VerseBook<W>;
  keysOf: (word: W) => readonly string[];
}

export interface DeckSourceText<W> {
  index: DeckSourceIndex;
  book: VerseBook<W>;
}

/** A stable identity for a source, for pairing a result with what it was built from. */
export function sourceKey(source: DeckSource | null | undefined): string | null {
  return source
    ? `${source.book} ${source.startChapter}:${source.startVerse}-${source.endChapter}:${source.endVerse}`
    : null;
}

export interface DeckSourceState<W> {
  /** The indexed text, once loaded; null while loading, on failure, or with no source. */
  text: DeckSourceText<W> | null;
  /** True while a source's text is on its way. False with no source and after a failure. */
  loading: boolean;
}

/**
 * The indexed text of `source`. `load` must be stable (a module-level
 * function): it is not a dependency, so a new function each render does not
 * refetch.
 */
export function useDeckSource<W>(
  source: DeckSource | null | undefined,
  load: (bookCode: string) => Promise<LoadedSource<W>>,
): DeckSourceState<W> {
  const key = sourceKey(source);
  const [held, setHeld] = useState<{ key: string; text: DeckSourceText<W> | null } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the source is keyed by value; `load` is stable by contract
  useEffect(() => {
    if (!source || key === null) return;
    let cancelled = false;
    load(source.book)
      .then(({ book, keysOf }) => {
        if (cancelled) return;
        setHeld({ key, text: { index: buildDeckSourceIndex(book, source, keysOf), book } });
      })
      .catch(() => {
        // No text, no chapters and no verse: the deck still studies as before.
        if (!cancelled) setHeld({ key, text: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const settled = held !== null && held.key === key;
  return { text: settled ? held.text : null, loading: key !== null && !settled };
}
