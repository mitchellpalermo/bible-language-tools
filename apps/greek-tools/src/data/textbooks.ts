// Textbook chapter decks (#228).
//
// A Greek course teaches chapter by chapter out of one grammar, and its
// vocabulary quizzes are scoped to a chapter's list, not to a frequency band.
// This module says which textbooks there are and joins each one's chapter map
// (`textbook-chapters.ts`) to the vocabulary, so a chapter is a study set of
// ordinary vocabulary entries: the same words, glosses and SRS cards as
// everywhere else on the site. The queries are `@tools/shared/textbooks`,
// shared with hebrew.tools.
//
// THE TEXTBOOK LIST IS DATA. Adding a book is an entry in `BOOKS` below and its
// chapter map; the deck chips, the chapter grid, the counts and the stored
// selection all read `TEXTBOOK_IDS`. Nothing in a component names a book.

import {
  type ChapterRef,
  createTextbookQueries,
  describeChapters as describeChapterSet,
  type ChapterStat as SharedChapterStat,
  type Textbook as SharedTextbook,
} from '@tools/shared/textbooks';
import {
  BEGINNING_GREEK_CHAPTERS,
  BEGINNING_GREEK_UNRESOLVED,
  type ChapterMap,
  type UnresolvedHeadword,
} from './textbook-chapters';
import { type VocabWord, vocabulary } from './vocabulary';

/**
 * One list per chapter, so one category. hebrew.tools' textbook prints several
 * (Core, Reading, Proper names); the shared model carries a category either way.
 */
export type VocabCategory = 'vocabulary';
export const CATEGORY_IDS: VocabCategory[] = ['vocabulary'];
export const DEFAULT_CATEGORIES: VocabCategory[] = ['vocabulary'];

interface Book extends Omit<SharedTextbook, 'id'> {
  chapters: ChapterMap;
  /** Headwords the book lists that have no vocabulary entry, so no card. */
  unresolved: readonly UnresolvedHeadword[];
}

const BOOKS = {
  'beginning-with-nt-greek': {
    title: 'Beginning with New Testament Greek',
    authors: 'Benjamin L. Merkle and Robert L. Plummer',
    shortTitle: 'Merkle & Plummer',
    unitLabel: 'Ch.',
    chapters: BEGINNING_GREEK_CHAPTERS,
    unresolved: BEGINNING_GREEK_UNRESOLVED,
  },
} satisfies Record<string, Book>;

/** Stored in the student's deck selection, so never rename an id. */
export type TextbookId = keyof typeof BOOKS;
export type Textbook = SharedTextbook<TextbookId>;
export type TextbookChapterRef = ChapterRef<TextbookId, VocabCategory>;
export type ChapterStat = SharedChapterStat<VocabCategory>;

export const TEXTBOOK_IDS = Object.keys(BOOKS) as TextbookId[];

export const TEXTBOOKS = Object.fromEntries(
  TEXTBOOK_IDS.map((id) => {
    const { title, authors, shortTitle, unitLabel } = BOOKS[id];
    return [id, { id, title, authors, shortTitle, unitLabel }];
  }),
) as Record<TextbookId, Textbook>;

/** Each book's chapter map, for the data tests. */
export const CHAPTER_MAPS = Object.fromEntries(
  TEXTBOOK_IDS.map((id) => [id, BOOKS[id].chapters]),
) as Record<TextbookId, ChapterMap>;

/** Each book's headwords with no card, for the data tests and the docs. */
export const UNRESOLVED_HEADWORDS = Object.fromEntries(
  TEXTBOOK_IDS.map((id) => [id, BOOKS[id].unresolved]),
) as Record<TextbookId, readonly UnresolvedHeadword[]>;

// ─── The join ─────────────────────────────────────────────────────────────────
//
// `vocabulary.ts` is generated from MorphGNT and Dodson and knows nothing of
// textbooks, so the tag is not a field on the word: it is looked up here, by
// the word's `greek` field. One word in two books is one entry with two refs.

const NO_CHAPTERS: readonly TextbookChapterRef[] = [];

const REFS = new Map<string, TextbookChapterRef[]>();
for (const textbook of TEXTBOOK_IDS) {
  for (const [chapter, lemmas] of Object.entries(BOOKS[textbook].chapters)) {
    for (const lemma of lemmas) {
      const refs = REFS.get(lemma) ?? [];
      refs.push({ textbook, chapter: Number(chapter), category: 'vocabulary' });
      REFS.set(lemma, refs);
    }
  }
}

/** The chapters that assign this word, across every textbook. Empty for most words. */
export function chaptersOf(word: VocabWord): readonly TextbookChapterRef[] {
  return REFS.get(word.greek) ?? NO_CHAPTERS;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const {
  isInChapter,
  /** Every word the chapter assigns, in vocabulary order (most frequent first). */
  wordsInChapter,
  /** Every chapter number the textbook has vocabulary for, ascending. */
  chapterNumbers,
  /** Words for a set of chapters. Empty `chapters` is the whole book. */
  wordsInChapters,
  /** Per-chapter counts, for labelling the picker's grid cells. */
  chapterStats,
  categoryCounts,
} = createTextbookQueries<VocabWord, TextbookId, VocabCategory>({
  words: vocabulary,
  getRefs: chaptersOf,
  categoryIds: CATEGORY_IDS,
});

/** "All chapters", "Ch. 4", "Ch. 1–8, 12". */
export function describeChapters(textbook: TextbookId, chapters: readonly number[]): string {
  return describeChapterSet(TEXTBOOKS[textbook].unitLabel, chapters);
}
