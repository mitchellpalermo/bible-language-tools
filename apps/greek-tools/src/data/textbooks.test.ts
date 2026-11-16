import { describe, expect, it } from 'vitest';
import {
  CATEGORY_IDS,
  CHAPTER_MAPS,
  categoryCounts,
  chapterNumbers,
  chapterStats,
  chaptersOf,
  DEFAULT_CATEGORIES,
  describeChapters,
  isInChapter,
  TEXTBOOK_IDS,
  TEXTBOOKS,
  wordsInChapter,
  wordsInChapters,
} from './textbooks';
import { vocabulary } from './vocabulary-all';

// The queries' rules are tested in @tools/shared's textbooks.test.ts. This
// checks the join: that a chapter comes back as this app's vocabulary entries.

const BOOK = 'beginning-with-nt-greek';
const word = (greek: string) => {
  const found = vocabulary.find((w) => w.greek === greek);
  if (!found) throw new Error(`no vocabulary entry ${greek}`);
  return found;
};

describe('TEXTBOOKS', () => {
  it('describes every id in TEXTBOOK_IDS, keyed by its own id', () => {
    expect(Object.keys(TEXTBOOKS)).toEqual(TEXTBOOK_IDS);
    for (const id of TEXTBOOK_IDS) {
      const book = TEXTBOOKS[id];
      expect(book.id).toBe(id);
      for (const field of [book.title, book.authors, book.shortTitle, book.unitLabel]) {
        expect(field.length).toBeGreaterThan(0);
      }
    }
  });

  it('labels every book so it cannot be mistaken for another', () => {
    // One pair of authors can have two books here, so a label is never only
    // the authors' names, and no two books share a label or a title.
    const books = TEXTBOOK_IDS.map((id) => TEXTBOOKS[id]);
    expect(new Set(books.map((b) => b.shortTitle)).size).toBe(books.length);
    expect(new Set(books.map((b) => b.title)).size).toBe(books.length);
    for (const book of books) {
      const surnames = book.authors
        .split(/,| and /)
        .map((name) => name.trim().split(' ').at(-1) ?? '')
        .filter(Boolean);
      for (const surname of surnames) expect(book.shortTitle).not.toContain(surname);
    }
  });

  it('keeps the id students have stored', () => {
    expect(TEXTBOOK_IDS).toContain('beginning-with-nt-greek');
    expect(TEXTBOOKS['beginning-with-nt-greek'].shortTitle).toBe('Beginning with NT Greek');
  });

  it('has a chapter map for every textbook', () => {
    expect(Object.keys(CHAPTER_MAPS)).toEqual(TEXTBOOK_IDS);
  });

  it('includes its one category by default', () => {
    expect(DEFAULT_CATEGORIES).toEqual(CATEGORY_IDS);
  });
});

describe('chaptersOf', () => {
  it('gives the chapter that assigns a word', () => {
    expect(chaptersOf(word('ἀγάπη'))).toEqual([
      { textbook: BOOK, chapter: 1, category: 'vocabulary' },
    ]);
  });

  it('finds the words the vocabulary prints in a display form', () => {
    expect(chaptersOf(word('ὁ, ἡ, τό'))[0].chapter).toBe(1);
    expect(chaptersOf(word('ἐκ, ἐξ'))[0].chapter).toBe(7);
    expect(chaptersOf(word('οὐ, οὐκ, οὐχ'))[0].chapter).toBe(5);
  });

  it('is empty for every word no textbook lists', () => {
    const unlisted = vocabulary.filter((w) => chaptersOf(w).length === 0);
    expect(unlisted.length).toBe(vocabulary.length - 345);
  });

  it('finds the three hand-kept words, which are not generated', () => {
    expect(chaptersOf(word('ἱερόν'))[0].chapter).toBe(2);
    expect(chaptersOf(word('δεῖ'))[0].chapter).toBe(20);
    expect(chaptersOf(word('ἐὰν μή'))[0].chapter).toBe(21);
    // δέω and ἱερός stay the cards they were, in the chapters they were.
    expect(chaptersOf(word('δέω'))[0].chapter).toBe(18);
    expect(chaptersOf(word('ἱερός'))).toEqual([]);
  });

  it('keeps τίς and τις apart', () => {
    expect(isInChapter(word('τίς'), BOOK, 19)).toBe(true);
    expect(isInChapter(word('τις'), BOOK, 19)).toBe(true);
    expect(word('τίς')).not.toBe(word('τις'));
  });
});

describe('the queries over the Greek vocabulary', () => {
  it('lists the chapters', () => {
    expect(chapterNumbers(BOOK)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
  });

  it('returns a chapter as vocabulary entries, most frequent first', () => {
    const chapter = wordsInChapter(BOOK, 1);
    expect(chapter).toHaveLength(15);
    expect(chapter[0]).toBe(word('ὁ, ἡ, τό'));
    for (const w of chapter) expect(vocabulary).toContain(w);
    const counts = chapter.map((w) => w.frequency);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('hands back the vocabulary’s own entry, gloss and all', () => {
    const love = wordsInChapters(BOOK, [1], ['vocabulary']).find((w) => w.greek === 'ἀγάπη');
    expect(love).toBe(word('ἀγάπη'));
  });

  it('reads no chapters as the whole book', () => {
    expect(wordsInChapters(BOOK, [], ['vocabulary'])).toHaveLength(345);
    expect(wordsInChapters(BOOK, [1, 2], ['vocabulary'])).toHaveLength(30);
  });

  it('counts each chapter for the picker', () => {
    const stats = chapterStats(BOOK);
    expect(stats).toHaveLength(23);
    expect(stats.every((s) => s.total === 15)).toBe(true);
    expect(stats.reduce((sum, s) => sum + s.total, 0)).toBe(345);
    expect(categoryCounts(BOOK, [3])).toEqual({ vocabulary: 15 });
  });

  it('describes a chapter set with the book’s own unit label', () => {
    expect(describeChapters(BOOK, [])).toBe('All chapters');
    expect(describeChapters(BOOK, [1, 2, 3, 9])).toBe('Ch. 1–3, 9');
  });
});
