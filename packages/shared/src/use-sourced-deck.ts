// A custom deck built from a book or passage, as the flashcards page studies
// it (#267, #270). Language-agnostic: both apps' `Flashcards.tsx` call this
// with the picked deck, a loader for the text, and the deck's card key.
//
// What it owns:
// - Loading the deck's text when the deck is picked (`useDeckSource`).
// - The chapters chosen for each deck, remembered per deck on this browser
//   (#270, decision 4), through `useStoredState` so hydration survives it.
// - Narrowing the deck's words to those chapters. A chapter is a filter, never
//   a copy: the words keep their one SRS card each.
// - What the session's `restartKey` must add, and what the picker and the
//   verse on reveal read.
//
// A deck with no source, a hand-picked deck, and a deck whose text failed to
// load all study exactly as before: no picker, no verse, no narrowing.

import { useCallback, useMemo } from 'react';
import type { CustomDeck } from './custom-decks';
import {
  type createDeckChapterMemory,
  type DeckChapters,
  type Occurrence,
  spansChapters,
  withDeckChapters,
} from './deck-source';
import { type DeckSourceText, type LoadedSource, useDeckSource } from './use-deck-source';
import { useStoredState } from './use-stored-state';

type ChapterMemory = ReturnType<typeof createDeckChapterMemory>;

export interface SourcedDeck<W> {
  /** The deck's text, once loaded. */
  text: DeckSourceText<W> | null;
  /** Chapters the student chose for this deck and the text has. Empty is the whole deck. */
  chapters: number[];
  setChapters: (chapters: number[]) => void;
  /**
   * The picker's grid: each chapter of the source with how many of the deck's
   * words occur in it. Null when there is nothing to pick (no source, one
   * chapter, or the text has not loaded).
   */
  pickerChapters: { chapter: number; total: number }[] | null;
  /**
   * Chapters are chosen but the text that says which words they hold is still
   * loading. A page should deal nothing yet rather than the whole deck, which
   * it would then have to take back.
   */
  pending: boolean;
  /** The deck's words narrowed to the chosen chapters, by card key. */
  narrow: <T>(words: T[], getKey: (word: T) => string) => T[];
  /** Where a card's word occurs in the source, for the verse on reveal. */
  occurrencesOf: (key: string) => readonly Occurrence[];
  /** Add to the session's `restartKey`: a change of chapters deals a new session. */
  restartPart: [number[], boolean];
}

const NONE: readonly Occurrence[] = [];

export function useSourcedDeck<W>(
  deck: CustomDeck | null,
  load: (bookCode: string) => Promise<LoadedSource<W>>,
  memory: ChapterMemory,
): SourcedDeck<W> {
  const source = deck?.source ?? null;
  const { text, loading } = useDeckSource(source, load);
  const [remembered, setRemembered] = useStoredState<DeckChapters>(memory.load, {}, memory.save);

  // Kept as text so the memo below compares the stored choice by value.
  const storedKey = JSON.stringify(
    deck && spansChapters(source) ? (remembered[deck.id] ?? []) : [],
  );
  // Only chapters the text has; until it loads, the stored choice stands.
  const chapters = useMemo(() => {
    const stored = JSON.parse(storedKey) as number[];
    return text ? stored.filter((c) => text.index.chapters.includes(c)) : stored;
  }, [text, storedKey]);

  const deckId = deck?.id ?? null;
  const setChapters = useCallback(
    (next: number[]) => {
      if (deckId !== null) setRemembered((prev) => withDeckChapters(prev, deckId, next));
    },
    [deckId, setRemembered],
  );

  const pickerChapters = useMemo(
    () =>
      deck && text && text.index.chapters.length > 1
        ? text.index.chapterStats(deck.wordKeys)
        : null,
    [deck, text],
  );

  const pending = chapters.length > 0 && loading;

  const narrow = useCallback(
    <T>(words: T[], getKey: (word: T) => string): T[] => {
      if (pending) return [];
      if (!text || chapters.length === 0) return words;
      return words.filter((w) => text.index.inChapters(getKey(w), chapters));
    },
    [pending, text, chapters],
  );

  const occurrencesOf = useCallback(
    (key: string) => (text ? text.index.occurrencesOf(key) : NONE),
    [text],
  );

  return {
    text,
    chapters,
    setChapters,
    pickerChapters,
    pending,
    narrow,
    occurrencesOf,
    restartPart: [chapters, pending],
  };
}
