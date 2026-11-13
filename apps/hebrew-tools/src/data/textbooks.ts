// Textbook chapter decks.
//
// Seminary Hebrew is taught chapter by chapter out of a specific grammar, and
// vocabulary quizzes are scoped to a chapter's list — not to a frequency band.
// This module turns the `chapters` tags carried on each `HebrewVocabWord` into
// ready-to-study selections.
//
// The tags live on the vocabulary entries rather than in a separate per-chapter
// word list here, so a word that appears in several textbooks (or in several
// chapters of the same textbook) is still a single entry with a single SRS card.
// That keeps the vocabulary modules the one source of truth; this module only
// queries them.
//
// A tag carries a category as well as a chapter, because the textbook does not
// print one flat list per chapter: it prints Core, Reading, Inflected, Proper
// Names, and derived-stem sections, and a word can sit in different sections in
// different chapters (learned as Core in ch. 10, revisited under derived stems
// in ch. 25). Category therefore belongs on the tag, not on the word.

import {
  createTextbookQueries,
  describeChapters as describeChapterSet,
  type ChapterStat as SharedChapterStat,
} from '@tools/shared/textbooks';
import { type HebrewVocabWord, vocabulary } from './vocabulary';

// `gd` is defined upstream of this module (see `vocabulary-types.ts`) because
// this one reads the vocabulary at module scope. Re-exported here so callers
// have a single import site for everything textbook-shaped.
export { gd } from './vocabulary-types';

export type TextbookId = 'garrett-derouchie';

/** The sections a textbook divides a chapter's vocabulary into. */
export type VocabCategory = 'core' | 'reading' | 'inflected' | 'proper' | 'derived' | 'special';

export interface Textbook {
  id: TextbookId;
  /** Full title, for attribution. */
  title: string;
  authors: string;
  /** Short label used in deck chips, e.g. "Garrett & DeRouchie". */
  shortTitle: string;
  /** Noun used for the numbered divisions of this book ("Chapter", "Unit"...). */
  unitLabel: string;
}

/** A word's membership in one section of one chapter of one textbook. */
export interface TextbookChapterRef {
  textbook: TextbookId;
  chapter: number;
  category: VocabCategory;
}

export const TEXTBOOKS: Record<TextbookId, Textbook> = {
  'garrett-derouchie': {
    id: 'garrett-derouchie',
    title: 'A Modern Grammar for Biblical Hebrew',
    authors: 'Duane A. Garrett and Jason S. DeRouchie',
    shortTitle: 'Garrett & DeRouchie',
    unitLabel: 'Ch.',
  },
};

export const TEXTBOOK_IDS = Object.keys(TEXTBOOKS) as TextbookId[];

// ─── Categories ───────────────────────────────────────────────────────────────

export interface CategoryMeta {
  id: VocabCategory;
  /** Chip label. */
  label: string;
  /** What the textbook means by the section, for the chip's title attribute. */
  description: string;
}

/**
 * Ordered as the study set should build up: Core is the list the quizzes come
 * from, and everything after it is supplementary.
 */
export const VOCAB_CATEGORIES: CategoryMeta[] = [
  {
    id: 'core',
    label: 'Core',
    description: 'The chapter’s required vocabulary — what the quizzes cover',
  },
  {
    id: 'reading',
    label: 'Reading',
    description: 'Words needed only for the chapter’s reading exercise',
  },
  {
    id: 'inflected',
    label: 'Inflected',
    description: 'Inflected forms of words already learned, listed for recognition',
  },
  { id: 'proper', label: 'Proper names', description: 'People and places' },
  {
    id: 'derived',
    label: 'Derived stems',
    description: 'Verbs already learned in the Qal, reintroduced in another binyan',
  },
  {
    id: 'special',
    label: 'Special',
    description: 'Entries the textbook singles out for extended discussion',
  },
];

export const CATEGORY_IDS = VOCAB_CATEGORIES.map((c) => c.id);

export const DEFAULT_CATEGORIES: VocabCategory[] = ['core'];

export function categoryLabel(category: VocabCategory): string {
  return VOCAB_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

// ─── Queries ──────────────────────────────────────────────────────────────────
//
// The queries themselves are `@tools/shared/textbooks`, shared with greek.tools
// (#228). This module binds them to the Hebrew vocabulary and its categories;
// what each one promises is documented there.

export type ChapterStat = SharedChapterStat<VocabCategory>;

const NO_CHAPTERS: TextbookChapterRef[] = [];

const queries = createTextbookQueries<HebrewVocabWord, TextbookId, VocabCategory>({
  words: vocabulary,
  getRefs: (word) => word.chapters ?? NO_CHAPTERS,
  categoryIds: CATEGORY_IDS,
});

export const {
  isInChapter,
  /** Every word tagged for the given textbook chapter, in vocabulary-file order. */
  wordsInChapter,
  /** Every chapter number the textbook has vocabulary for, ascending. */
  chapterNumbers,
  /** Words for a set of chapters and categories. Empty `chapters` is the whole book. */
  wordsInChapters,
  /** Per-chapter counts, for labelling the picker's grid cells. */
  chapterStats,
  /** How many words each category would contribute to the current chapter set. */
  categoryCounts,
} = queries;

/**
 * A short human label for a chapter set: "All chapters", "Ch. 4", "Ch. 1–8",
 * "Ch. 1–8, 12, 20–22".
 */
export function describeChapters(textbook: TextbookId, chapters: number[]): string {
  return describeChapterSet(TEXTBOOKS[textbook].unitLabel, chapters);
}
