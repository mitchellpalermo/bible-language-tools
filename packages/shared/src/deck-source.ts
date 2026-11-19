// What a deck built from a book or passage knows about its text (#267, #270).
// Language-agnostic.
//
// A deck stores only its source range (`CustomDeck.source`); everything here
// is read from the book when the deck is studied. One index serves both
// features:
//
// - #270, studying the deck one chapter at a time: `chaptersOf`, `chapterStats`
//   and `inChapters` are projections of the occurrences onto chapter numbers.
// - #267, the verse on reveal: `occurrencesOf` is every place a word occurs in
//   the source, in reading order.
//
// Each app supplies `keysOf`, which says which SRS keys a word in the text is
// an occurrence of. greek.tools: the MorphGNT lemma, when the vocabulary has
// it. hebrew.tools: every card key of the word's lexeme, through the same join
// focus passages use, so a chapter's words agree with what Focus Passages lists
// for those verses. A word that is no card's is skipped.
//
// A CHAPTER IS A FILTER, NEVER A COPY (decision on #270, Nov 2026). A word that
// occurs in chapters 1, 3 and 4 is in all three chapter lists, and it is one
// card with one schedule in every one of them and in the whole deck.

import type { DeckSource } from './custom-decks';
import { formatPassageRef, type VerseBook, versesInRange } from './focus-passages';

/** One place a word occurs: a verse, and the word's position in it (0-based). */
export interface Occurrence {
  chapter: number;
  verse: number;
  position: number;
}

export interface DeckSourceIndex {
  readonly range: DeckSource;
  /** Every chapter the range touches, ascending. */
  readonly chapters: readonly number[];
  /** Where a card's word occurs in the range, in reading order. Empty when it does not. */
  occurrencesOf(key: string): readonly Occurrence[];
  /** The chapters a card's word occurs in, ascending. */
  chaptersOf(key: string): number[];
  /** For each chapter of the range, how many of `keys` occur in it: the picker's counts. */
  chapterStats(keys: readonly string[]): { chapter: number; total: number }[];
  /**
   * Whether a card's word occurs in any of `chapters`. An empty list is the
   * whole deck, as it is for a textbook, so a word added to the deck by hand
   * (which occurs nowhere in the text) is in it then and in no chapter.
   */
  inChapters(key: string, chapters: readonly number[]): boolean;
}

/**
 * Index a book over a deck's range. `keysOf` returns the SRS keys a word of
 * the text is an occurrence of (usually one, none for a word that is no card).
 */
export function buildDeckSourceIndex<W>(
  book: VerseBook<W>,
  range: DeckSource,
  keysOf: (word: W) => readonly string[],
): DeckSourceIndex {
  const occurrences = new Map<string, Occurrence[]>();
  const chapterSet = new Set<number>();
  for (const { chapter, verse, words } of versesInRange(book, range)) {
    chapterSet.add(chapter);
    words.forEach((word, position) => {
      for (const key of new Set(keysOf(word))) {
        const held = occurrences.get(key);
        const at = { chapter, verse, position };
        if (held) held.push(at);
        else occurrences.set(key, [at]);
      }
    });
  }

  const chapters = [...chapterSet].sort((a, b) => a - b);
  const chaptersOf = (key: string) => [
    ...new Set((occurrences.get(key) ?? []).map((o) => o.chapter)),
  ];

  return {
    range,
    chapters,
    occurrencesOf: (key) => occurrences.get(key) ?? [],
    chaptersOf,
    chapterStats(keys) {
      const counts = new Map(chapters.map((c) => [c, 0]));
      for (const key of new Set(keys)) {
        for (const chapter of chaptersOf(key)) counts.set(chapter, (counts.get(chapter) ?? 0) + 1);
      }
      return chapters.map((chapter) => ({ chapter, total: counts.get(chapter) ?? 0 }));
    },
    inChapters(key, wanted) {
      if (wanted.length === 0) return true;
      return occurrences.get(key)?.some((o) => wanted.includes(o.chapter)) ?? false;
    },
  };
}

/** A whole book as a deck source: its first verse to its last. Null for a book with no verses. */
export function wholeBookSource<W>(bookCode: string, book: VerseBook<W>): DeckSource | null {
  const numbers = (o: object) =>
    Object.keys(o)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);
  const chapters = numbers(book).filter((c) => numbers(book[String(c)]).length > 0);
  if (chapters.length === 0) return null;
  const first = chapters[0];
  const last = chapters[chapters.length - 1];
  const lastVerses = numbers(book[String(last)]);
  return {
    book: bookCode,
    startChapter: first,
    startVerse: numbers(book[String(first)])[0],
    endChapter: last,
    endVerse: lastVerses[lastVerses.length - 1],
  };
}

/**
 * What a count or a picker is "in": the book's name for a whole-book deck, the
 * passage's reference for a passage deck ("Galatians 2:11–21").
 */
export function describeSource<W>(range: DeckSource, book: VerseBook<W>, bookName: string): string {
  const whole = wholeBookSource(range.book, book);
  const isWhole =
    whole !== null &&
    whole.startChapter === range.startChapter &&
    whole.startVerse === range.startVerse &&
    whole.endChapter === range.endChapter &&
    whole.endVerse === range.endVerse;
  return isWhole ? bookName : formatPassageRef(bookName, range);
}

/**
 * Whether a deck can be narrowed by chapter: a source that spans more than one.
 * A one-chapter passage (John 3:1–21) has nothing to narrow, so it shows no
 * picker. Readable from the range alone, before the book has loaded.
 */
export function spansChapters(source: DeckSource | undefined | null): boolean {
  return source != null && source.endChapter > source.startChapter;
}

// ─── The verse on reveal (#267) ──────────────────────────────────────────────

/**
 * Past this many occurrences in the source the verse is folded away behind
 * "Show a verse": for καί or the article a verse says nothing about the word.
 * A fixed count, to be tuned from use (#267, decision 4).
 */
export const COMMON_WORD_THRESHOLD = 50;

/** Whether the verse starts folded for a word with this many occurrences. */
export function startsFolded(count: number): boolean {
  return count > COMMON_WORD_THRESHOLD;
}

// ─── Chapters remembered per deck (#270, decision 4) ─────────────────────────

/** Chosen chapters by deck id. Empty or absent is the whole deck. */
export type DeckChapters = Record<string, number[]>;

/** Coerce stored chapters into a usable map: positive whole numbers, sorted, once each. */
export function normalizeDeckChapters(raw: unknown): DeckChapters {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: DeckChapters = {};
  for (const [id, chapters] of Object.entries(raw)) {
    if (!Array.isArray(chapters)) continue;
    const clean = [
      ...new Set(chapters.filter((c): c is number => Number.isInteger(c) && c > 0)),
    ].sort((a, b) => a - b);
    if (clean.length > 0) out[id] = clean;
  }
  return out;
}

/** Set one deck's chapters, dropping the entry when it is the whole deck. */
export function withDeckChapters(
  memory: DeckChapters,
  deckId: string,
  chapters: readonly number[],
): DeckChapters {
  const { [deckId]: _old, ...rest } = memory;
  return chapters.length > 0 ? { ...rest, [deckId]: [...chapters].sort((a, b) => a - b) } : rest;
}

/**
 * The chapters a student chose for each deck built from the text, so a deck
 * comes back narrowed the way it was left. A study posture like the textbook
 * selection, so it is local to the browser and never synced; bound to a key
 * per app as every other store here is.
 */
export function createDeckChapterMemory(storageKey: string) {
  return {
    load(): DeckChapters {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? normalizeDeckChapters(JSON.parse(raw)) : {};
      } catch {
        return {};
      }
    },
    save(memory: DeckChapters): void {
      try {
        localStorage.setItem(storageKey, JSON.stringify(memory));
      } catch {
        // A full or disabled localStorage must not interrupt a study session.
      }
    },
  };
}
