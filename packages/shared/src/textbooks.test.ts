import { describe, expect, it } from 'vitest';
import { type ChapterRef, createTextbookQueries, describeChapters } from './textbooks';

type Book = 'primer' | 'reader';
type Category = 'core' | 'names';

interface Word {
  id: string;
  refs?: ChapterRef<Book, Category>[];
}

const ref = (textbook: Book, chapter: number, category: Category = 'core') => ({
  textbook,
  chapter,
  category,
});

// A word in one chapter, one in two chapters, one in two categories, one in
// another book, and one no book lists.
const WORDS: Word[] = [
  { id: 'a', refs: [ref('primer', 1)] },
  { id: 'b', refs: [ref('primer', 1), ref('primer', 3)] },
  { id: 'c', refs: [ref('primer', 2, 'names')] },
  { id: 'd', refs: [ref('primer', 3), ref('primer', 5, 'names')] },
  { id: 'e', refs: [ref('reader', 1)] },
  { id: 'f' },
];

const q = createTextbookQueries<Word, Book, Category>({
  words: WORDS,
  getRefs: (w) => w.refs ?? [],
  categoryIds: ['core', 'names'],
});

const ids = (words: Word[]) => words.map((w) => w.id);

describe('isInChapter', () => {
  it('matches on textbook and chapter', () => {
    expect(q.isInChapter(WORDS[0], 'primer', 1)).toBe(true);
    expect(q.isInChapter(WORDS[0], 'primer', 2)).toBe(false);
    expect(q.isInChapter(WORDS[0], 'reader', 1)).toBe(false);
  });

  it('narrows by category when one is given', () => {
    expect(q.isInChapter(WORDS[2], 'primer', 2, ['core'])).toBe(false);
    expect(q.isInChapter(WORDS[2], 'primer', 2, ['names'])).toBe(true);
  });

  it('is false for a word no textbook lists', () => {
    expect(q.isInChapter(WORDS[5], 'primer', 1)).toBe(false);
  });
});

describe('wordsInChapter', () => {
  it('returns the chapter in the order the words were given', () => {
    expect(ids(q.wordsInChapter('primer', 3))).toEqual(['b', 'd']);
    expect(ids(q.wordsInChapter('primer', 2, ['core']))).toEqual([]);
  });
});

describe('chapterNumbers', () => {
  it('lists each chapter once, ascending, for that textbook only', () => {
    expect(q.chapterNumbers('primer')).toEqual([1, 2, 3, 5]);
    expect(q.chapterNumbers('reader')).toEqual([1]);
  });
});

describe('wordsInChapters', () => {
  it('reads an empty chapter list as the whole textbook', () => {
    expect(ids(q.wordsInChapters('primer', [], ['core', 'names']))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns a word once when two selected chapters both list it', () => {
    expect(ids(q.wordsInChapters('primer', [1, 3], ['core']))).toEqual(['a', 'b', 'd']);
  });

  it('reads an empty category list as nothing', () => {
    expect(q.wordsInChapters('primer', [1], [])).toEqual([]);
  });

  it('counts a word only under the category that chapter gives it', () => {
    // d is core in chapter 3 and a name in chapter 5.
    expect(ids(q.wordsInChapters('primer', [5], ['core']))).toEqual([]);
    expect(ids(q.wordsInChapters('primer', [5], ['names']))).toEqual(['d']);
  });

  it('never returns another textbook’s words', () => {
    expect(ids(q.wordsInChapters('reader', [], ['core', 'names']))).toEqual(['e']);
  });
});

describe('chapterStats', () => {
  it('counts each chapter in total and by category, ascending', () => {
    expect(q.chapterStats('primer')).toEqual([
      { chapter: 1, total: 2, byCategory: { core: 2, names: 0 } },
      { chapter: 2, total: 1, byCategory: { core: 0, names: 1 } },
      { chapter: 3, total: 2, byCategory: { core: 2, names: 0 } },
      { chapter: 5, total: 1, byCategory: { core: 0, names: 1 } },
    ]);
  });
});

describe('categoryCounts', () => {
  it('says what each category would add to the chapter set', () => {
    expect(q.categoryCounts('primer', [])).toEqual({ core: 3, names: 2 });
    expect(q.categoryCounts('primer', [1, 2])).toEqual({ core: 2, names: 1 });
  });
});

describe('a word list that grows after the queries were made', () => {
  it('is read on each call', () => {
    const words: Word[] = [];
    const late = createTextbookQueries<Word, Book, Category>({
      words,
      getRefs: (w) => w.refs ?? [],
      categoryIds: ['core', 'names'],
    });
    words.push({ id: 'z', refs: [ref('primer', 9)] });
    expect(late.chapterNumbers('primer')).toEqual([9]);
  });
});

describe('describeChapters', () => {
  it('names an empty set as every chapter', () => {
    expect(describeChapters('Ch.', [])).toBe('All chapters');
  });

  it('names one chapter', () => {
    expect(describeChapters('Ch.', [4])).toBe('Ch. 4');
  });

  it('collapses a run to a range and keeps gaps apart', () => {
    expect(describeChapters('Ch.', [1, 2, 3, 12, 20, 21, 22])).toBe('Ch. 1–3, 12, 20–22');
    expect(describeChapters('Unit', [1, 3])).toBe('Unit 1, 3');
  });

  it('sorts and de-duplicates first', () => {
    expect(describeChapters('Ch.', [3, 1, 2, 2])).toBe('Ch. 1–3');
  });
});
