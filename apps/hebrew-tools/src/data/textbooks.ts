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

export function isInChapter(
  word: HebrewVocabWord,
  textbook: TextbookId,
  chapter: number,
  categories?: VocabCategory[],
): boolean {
  return (word.chapters ?? []).some(
    (c) =>
      c.textbook === textbook &&
      c.chapter === chapter &&
      (categories === undefined || categories.includes(c.category)),
  );
}

/** Every word tagged for the given textbook chapter, in vocabulary-file order. */
export function wordsInChapter(
  textbook: TextbookId,
  chapter: number,
  categories?: VocabCategory[],
): HebrewVocabWord[] {
  return vocabulary.filter((w) => isInChapter(w, textbook, chapter, categories));
}

/** Every chapter number the textbook has vocabulary for, ascending. */
export function chapterNumbers(textbook: TextbookId): number[] {
  const chapters = new Set<number>();
  for (const word of vocabulary) {
    for (const ref of word.chapters ?? []) {
      if (ref.textbook === textbook) chapters.add(ref.chapter);
    }
  }
  return [...chapters].sort((a, b) => a - b);
}

/**
 * Words for a set of chapters, narrowed to a set of categories.
 *
 * An empty `chapters` means the whole textbook rather than nothing — the picker
 * treats "no chapter selected" as "not narrowed", which is the state a fresh
 * session starts in. An empty `categories` genuinely means nothing, because the
 * user had to switch every category off to get there.
 *
 * A word tagged in several selected chapters is returned once: the result is a
 * study set, not a tally.
 */
export function wordsInChapters(
  textbook: TextbookId,
  chapters: number[],
  categories: VocabCategory[],
): HebrewVocabWord[] {
  const wanted = chapters.length > 0 ? new Set(chapters) : null;
  return vocabulary.filter((word) =>
    (word.chapters ?? []).some(
      (ref) =>
        ref.textbook === textbook &&
        (wanted === null || wanted.has(ref.chapter)) &&
        categories.includes(ref.category),
    ),
  );
}

export interface ChapterStat {
  chapter: number;
  /** Words in this chapter across every category. */
  total: number;
  /** Words in this chapter, per category. Absent categories are 0. */
  byCategory: Record<VocabCategory, number>;
}

/** Per-chapter counts, for labelling the picker's grid cells. */
export function chapterStats(textbook: TextbookId): ChapterStat[] {
  const stats = new Map<number, ChapterStat>();
  for (const word of vocabulary) {
    for (const ref of word.chapters ?? []) {
      if (ref.textbook !== textbook) continue;
      let stat = stats.get(ref.chapter);
      if (!stat) {
        stat = {
          chapter: ref.chapter,
          total: 0,
          byCategory: Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Record<
            VocabCategory,
            number
          >,
        };
        stats.set(ref.chapter, stat);
      }
      stat.total += 1;
      stat.byCategory[ref.category] += 1;
    }
  }
  return [...stats.values()].sort((a, b) => a.chapter - b.chapter);
}

/** How many words each category would contribute to the current chapter set. */
export function categoryCounts(
  textbook: TextbookId,
  chapters: number[],
): Record<VocabCategory, number> {
  const counts = Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Record<
    VocabCategory,
    number
  >;
  for (const category of CATEGORY_IDS) {
    counts[category] = wordsInChapters(textbook, chapters, [category]).length;
  }
  return counts;
}

/**
 * A short human label for a chapter set: "All chapters", "Ch. 4", "Ch. 1–8",
 * "Ch. 1–8, 12, 20–22". Consecutive runs collapse to a range, which is what
 * makes a section-exam selection readable at a glance in the collapsed picker.
 */
export function describeChapters(textbook: TextbookId, chapters: number[]): string {
  const book = TEXTBOOKS[textbook];
  if (chapters.length === 0) return 'All chapters';

  const sorted = [...new Set(chapters)].sort((a, b) => a - b);
  const runs: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (const chapter of sorted.slice(1)) {
    if (chapter === prev + 1) {
      prev = chapter;
      continue;
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = chapter;
  }
  runs.push(start === prev ? `${start}` : `${start}–${prev}`);

  return `${book.unitLabel} ${runs.join(', ')}`;
}
