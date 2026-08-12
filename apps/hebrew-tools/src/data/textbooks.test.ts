import { describe, expect, it } from 'vitest';
import {
  CATEGORY_IDS,
  categoryCounts,
  categoryLabel,
  chapterNumbers,
  chapterStats,
  DEFAULT_CATEGORIES,
  describeChapters,
  gd,
  isInChapter,
  TEXTBOOK_IDS,
  TEXTBOOKS,
  VOCAB_CATEGORIES,
  wordsInChapter,
  wordsInChapters,
} from './textbooks';
import { vocabulary } from './vocabulary';

describe('TEXTBOOKS', () => {
  it('keys every entry by its own id', () => {
    for (const id of TEXTBOOK_IDS) {
      expect(TEXTBOOKS[id].id).toBe(id);
    }
  });

  it('gives every textbook a title, authors, short title, and unit label', () => {
    for (const id of TEXTBOOK_IDS) {
      const book = TEXTBOOKS[id];
      expect(book.title.trim().length).toBeGreaterThan(0);
      expect(book.authors.trim().length).toBeGreaterThan(0);
      expect(book.shortTitle.trim().length).toBeGreaterThan(0);
      expect(book.unitLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it('includes Garrett & DeRouchie', () => {
    expect(TEXTBOOKS['garrett-derouchie'].title).toBe('A Modern Grammar for Biblical Hebrew');
  });
});

describe('gd', () => {
  it('builds a Garrett & DeRouchie chapter reference', () => {
    expect(gd(3, 'core')).toEqual({
      textbook: 'garrett-derouchie',
      chapter: 3,
      category: 'core',
    });
  });
});

describe('VOCAB_CATEGORIES', () => {
  it('describes every category id exactly once', () => {
    expect(new Set(CATEGORY_IDS).size).toBe(CATEGORY_IDS.length);
    for (const category of VOCAB_CATEGORIES) {
      expect(category.label.trim().length).toBeGreaterThan(0);
      expect(category.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('lists core first, because it is what the quizzes cover', () => {
    expect(CATEGORY_IDS[0]).toBe('core');
    expect(DEFAULT_CATEGORIES).toEqual(['core']);
  });

  it('labels a known category and falls back to the raw id', () => {
    expect(categoryLabel('proper')).toBe('Proper names');
    // The fallback exists so an unlisted category never renders as blank.
    expect(categoryLabel('nope' as never)).toBe('nope');
  });

  it('accounts for every category tag present in the data', () => {
    const used = new Set(vocabulary.flatMap((w) => (w.chapters ?? []).map((c) => c.category)));
    for (const category of used) {
      expect(CATEGORY_IDS, `Untyped category in data: ${category}`).toContain(category);
    }
  });
});

describe('isInChapter', () => {
  const word = vocabulary.find((w) => w.hebrew === 'מֶלֶךְ')!;

  it('is true for a chapter the word is tagged with', () => {
    expect(isInChapter(word, 'garrett-derouchie', 1)).toBe(true);
  });

  it('is false for a chapter the word is not tagged with', () => {
    expect(isInChapter(word, 'garrett-derouchie', 999)).toBe(false);
  });

  it('is false for an untagged word', () => {
    const untagged = vocabulary.find((w) => w.chapters === undefined)!;
    expect(isInChapter(untagged, 'garrett-derouchie', 1)).toBe(false);
  });

  it('narrows by category when one is given', () => {
    expect(isInChapter(word, 'garrett-derouchie', 1, ['core'])).toBe(true);
    expect(isInChapter(word, 'garrett-derouchie', 1, ['reading'])).toBe(false);
  });
});

describe('wordsInChapter', () => {
  it('returns exactly the words tagged for that chapter', () => {
    const words = wordsInChapter('garrett-derouchie', 1);
    expect(words.length).toBeGreaterThan(0);
    for (const word of words) {
      expect(isInChapter(word, 'garrett-derouchie', 1)).toBe(true);
    }
  });

  it('returns an empty array for a chapter with no vocabulary yet', () => {
    expect(wordsInChapter('garrett-derouchie', 999)).toEqual([]);
  });
});

describe('chapterNumbers', () => {
  const chapters = chapterNumbers('garrett-derouchie');

  it('is sorted ascending with no duplicates', () => {
    expect(chapters).toEqual([...new Set(chapters)].sort((a, b) => a - b));
  });

  it('covers chapter 1 through the end of the imported handout', () => {
    expect(chapters[0]).toBe(1);
    expect(chapters).toContain(31);
    expect(chapters.length).toBe(31);
  });
});

describe('wordsInChapters', () => {
  it('treats an empty chapter list as the whole textbook', () => {
    const all = wordsInChapters('garrett-derouchie', [], CATEGORY_IDS);
    const enumerated = wordsInChapters(
      'garrett-derouchie',
      chapterNumbers('garrett-derouchie'),
      CATEGORY_IDS,
    );
    expect(all).toEqual(enumerated);
    expect(all.length).toBeGreaterThan(0);
  });

  it('treats an empty category list as nothing', () => {
    expect(wordsInChapters('garrett-derouchie', [], [])).toEqual([]);
  });

  it('returns a word tagged in several selected chapters only once', () => {
    // כתב is core in ch. 9 and reappears under derived stems in ch. 20.
    const shared = vocabulary.filter(
      (w) => (w.chapters ?? []).filter((c) => c.textbook === 'garrett-derouchie').length > 1,
    );
    expect(shared.length).toBeGreaterThan(0);

    const words = wordsInChapters(
      'garrett-derouchie',
      chapterNumbers('garrett-derouchie'),
      CATEGORY_IDS,
    );
    expect(new Set(words).size).toBe(words.length);
  });

  it('narrows to the requested categories', () => {
    const core = wordsInChapters('garrett-derouchie', [], ['core']);
    const all = wordsInChapters('garrett-derouchie', [], CATEGORY_IDS);
    expect(core.length).toBeGreaterThan(0);
    expect(core.length).toBeLessThan(all.length);
    for (const word of core) {
      expect(
        (word.chapters ?? []).some(
          (c) => c.textbook === 'garrett-derouchie' && c.category === 'core',
        ),
      ).toBe(true);
    }
  });

  it('ignores chapters the textbook does not have', () => {
    expect(wordsInChapters('garrett-derouchie', [999], CATEGORY_IDS)).toEqual([]);
  });
});

describe('chapterStats', () => {
  const stats = chapterStats('garrett-derouchie');

  it('covers every chapter, ascending', () => {
    expect(stats.map((s) => s.chapter)).toEqual(chapterNumbers('garrett-derouchie'));
  });

  it('never reports an empty chapter', () => {
    for (const stat of stats) {
      expect(stat.total).toBeGreaterThan(0);
    }
  });

  it('splits the total across categories exactly', () => {
    for (const stat of stats) {
      const summed = CATEGORY_IDS.reduce((n, id) => n + stat.byCategory[id], 0);
      expect(summed, `Ch. ${stat.chapter} categories do not sum to its total`).toBe(stat.total);
    }
  });
});

describe('categoryCounts', () => {
  it('counts each category within the selected chapters', () => {
    const counts = categoryCounts('garrett-derouchie', [2]);
    expect(counts.core).toBe(wordsInChapters('garrett-derouchie', [2], ['core']).length);
    expect(counts.core).toBeGreaterThan(0);
  });

  it('reports zero for a category absent from the selection', () => {
    // Chapter 1 is core-only.
    expect(categoryCounts('garrett-derouchie', [1]).reading).toBe(0);
  });

  it('has an entry for every category id', () => {
    const counts = categoryCounts('garrett-derouchie', []);
    expect(Object.keys(counts).sort()).toEqual([...CATEGORY_IDS].sort());
  });
});

describe('describeChapters', () => {
  it('calls an empty selection "All chapters"', () => {
    expect(describeChapters('garrett-derouchie', [])).toBe('All chapters');
  });

  it('names a single chapter', () => {
    expect(describeChapters('garrett-derouchie', [4])).toBe('Ch. 4');
  });

  it('collapses a consecutive run into a range', () => {
    expect(describeChapters('garrett-derouchie', [1, 2, 3, 4, 5, 6, 7, 8])).toBe('Ch. 1–8');
  });

  it('separates non-consecutive runs', () => {
    expect(describeChapters('garrett-derouchie', [1, 2, 3, 12, 20, 21, 22])).toBe(
      'Ch. 1–3, 12, 20–22',
    );
  });

  it('does not collapse a two-chapter gap', () => {
    expect(describeChapters('garrett-derouchie', [1, 3])).toBe('Ch. 1, 3');
  });

  it('sorts and de-duplicates its input', () => {
    expect(describeChapters('garrett-derouchie', [3, 1, 2, 2])).toBe('Ch. 1–3');
  });
});
