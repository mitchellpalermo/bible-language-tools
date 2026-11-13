// Textbook chapter decks: the queries. Language-agnostic.
//
// A course teaches chapter by chapter out of one grammar, and its vocabulary
// quizzes are scoped to a chapter's list, not to a frequency band. Each app
// says which of its words a chapter assigns (a `ChapterRef` per word, per
// chapter) and this module turns those into study sets and the counts the
// picker shows. hebrew.tools (#109) carries the refs on the word; greek.tools
// (#228) joins them from a lemma-to-chapter map. Both go through `getRefs`, so
// neither shape is baked in here.
//
// A ref carries a category as well as a chapter because a textbook may print
// several lists per chapter (Core, Reading, Proper names) and a word can sit in
// different lists in different chapters. A book with one flat list per chapter
// has one category.
//
// A word tagged in several chapters, or by several textbooks, is still one
// word with one SRS card: these functions return words, never copies.

/** What the picker and the attribution line need to know about a book. */
export interface Textbook<B extends string = string> {
  id: B;
  /** Full title, for attribution. */
  title: string;
  authors: string;
  /** Short label used in deck chips. */
  shortTitle: string;
  /** What the book's numbered divisions are called on a chip: "Ch.", "Unit". */
  unitLabel: string;
}

/** A word's membership in one section of one chapter of one textbook. */
export interface ChapterRef<B extends string = string, C extends string = string> {
  textbook: B;
  chapter: number;
  category: C;
}

export interface ChapterStat<C extends string = string> {
  chapter: number;
  /** Words in this chapter across every category. */
  total: number;
  /** Words in this chapter, per category. Absent categories are 0. */
  byCategory: Record<C, number>;
}

export interface TextbookQueries<W, B extends string, C extends string> {
  isInChapter(word: W, textbook: B, chapter: number, categories?: readonly C[]): boolean;
  /** Every word tagged for the chapter, in the order the app lists its words. */
  wordsInChapter(textbook: B, chapter: number, categories?: readonly C[]): W[];
  /** Every chapter number the textbook has vocabulary for, ascending. */
  chapterNumbers(textbook: B): number[];
  /**
   * Words for a set of chapters, narrowed to a set of categories.
   *
   * An empty `chapters` means the whole textbook rather than nothing: the
   * picker treats "no chapter selected" as "not narrowed", which is the state
   * a fresh session starts in. An empty `categories` does mean nothing, because
   * the student had to switch every category off to get there.
   *
   * A word tagged in several selected chapters is returned once: the result is
   * a study set, not a tally.
   */
  wordsInChapters(textbook: B, chapters: readonly number[], categories: readonly C[]): W[];
  /** Per-chapter counts, for labelling the picker's grid cells. */
  chapterStats(textbook: B): ChapterStat<C>[];
  /** How many words each category would contribute to the given chapter set. */
  categoryCounts(textbook: B, chapters: readonly number[]): Record<C, number>;
}

/**
 * The queries, bound to one app's word list.
 *
 * `words` is read on every call rather than indexed once, so a caller may pass
 * a list that is still being built when this runs (hebrew.tools' vocabulary
 * modules import each other in a line; see its CLAUDE.md).
 */
export function createTextbookQueries<W, B extends string, C extends string>(options: {
  words: readonly W[];
  /** The chapters that assign this word. Empty for a word no textbook lists. */
  getRefs: (word: W) => readonly ChapterRef<B, C>[];
  /** Every category, in the order the chips show them. */
  categoryIds: readonly C[];
}): TextbookQueries<W, B, C> {
  const { words, getRefs, categoryIds } = options;

  const zeroCounts = () => Object.fromEntries(categoryIds.map((c) => [c, 0])) as Record<C, number>;

  function isInChapter(word: W, textbook: B, chapter: number, categories?: readonly C[]): boolean {
    return getRefs(word).some(
      (ref) =>
        ref.textbook === textbook &&
        ref.chapter === chapter &&
        (categories === undefined || categories.includes(ref.category)),
    );
  }

  function wordsInChapters(
    textbook: B,
    chapters: readonly number[],
    categories: readonly C[],
  ): W[] {
    const wanted = chapters.length > 0 ? new Set(chapters) : null;
    return words.filter((word) =>
      getRefs(word).some(
        (ref) =>
          ref.textbook === textbook &&
          (wanted === null || wanted.has(ref.chapter)) &&
          categories.includes(ref.category),
      ),
    );
  }

  return {
    isInChapter,
    wordsInChapters,

    wordsInChapter: (textbook, chapter, categories) =>
      words.filter((word) => isInChapter(word, textbook, chapter, categories)),

    chapterNumbers(textbook) {
      const chapters = new Set<number>();
      for (const word of words) {
        for (const ref of getRefs(word)) {
          if (ref.textbook === textbook) chapters.add(ref.chapter);
        }
      }
      return [...chapters].sort((a, b) => a - b);
    },

    chapterStats(textbook) {
      const stats = new Map<number, ChapterStat<C>>();
      for (const word of words) {
        for (const ref of getRefs(word)) {
          if (ref.textbook !== textbook) continue;
          let stat = stats.get(ref.chapter);
          if (!stat) {
            stat = { chapter: ref.chapter, total: 0, byCategory: zeroCounts() };
            stats.set(ref.chapter, stat);
          }
          stat.total += 1;
          stat.byCategory[ref.category] += 1;
        }
      }
      return [...stats.values()].sort((a, b) => a.chapter - b.chapter);
    },

    categoryCounts(textbook, chapters) {
      const counts = zeroCounts();
      for (const category of categoryIds) {
        counts[category] = wordsInChapters(textbook, chapters, [category]).length;
      }
      return counts;
    },
  };
}

/**
 * A short label for a chapter set: "All chapters", "Ch. 4", "Ch. 1–8",
 * "Ch. 1–8, 12, 20–22". Consecutive runs collapse to a range, which is what
 * makes a section-exam selection readable at a glance in the collapsed picker.
 */
export function describeChapters(unitLabel: string, chapters: readonly number[]): string {
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

  return `${unitLabel} ${runs.join(', ')}`;
}
