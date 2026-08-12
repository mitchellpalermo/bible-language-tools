import { describe, expect, it } from 'vitest';

import { BOOKS } from './books.mjs';

/**
 * The book table is hand-written, and every field in it is load-bearing: `file`
 * is a URL path at build time, `code` is a URL parameter and an output filename,
 * and a typo in either fails only at fetch time against a 404 from GitHub. These
 * are the invariants that make such a typo fail here instead.
 */
describe('BOOKS', () => {
  it('covers the whole Hebrew Bible', () => {
    expect(BOOKS).toHaveLength(39);
  });

  it('is in Tanakh order, grouped by division', () => {
    const sections = BOOKS.map((b) => b.section);
    // Torah, then Nevi'im, then Ketuvim — with no interleaving
    expect([...new Set(sections)]).toEqual(['torah', 'neviim', 'ketuvim']);
    expect(sections.filter((s) => s === 'torah')).toHaveLength(5);
    expect(sections.filter((s) => s === 'neviim')).toHaveLength(21);
    expect(sections.filter((s) => s === 'ketuvim')).toHaveLength(13);
  });

  it('opens with Genesis and closes with Chronicles', () => {
    expect(BOOKS[0]).toMatchObject({ code: 'GEN', file: 'Gen' });
    expect(BOOKS.at(-1)).toMatchObject({ code: '2CH', file: '2Chr' });
  });

  it('has a unique code and a unique source file per book', () => {
    expect(new Set(BOOKS.map((b) => b.code)).size).toBe(39);
    expect(new Set(BOOKS.map((b) => b.file)).size).toBe(39);
  });

  it('uses three-character Paratext codes', () => {
    for (const book of BOOKS) {
      expect(book.code).toMatch(/^[0-9A-Z]{3}$/);
    }
  });

  it('names every book in English and in Hebrew', () => {
    for (const book of BOOKS) {
      expect(book.name).toBeTruthy();
      // pointed Hebrew consonants, and nothing outside the Hebrew block but spaces
      expect(book.hebrew).toMatch(/^[֐-׿ ]+$/);
    }
  });

  it('writes the Hebrew names without cantillation', () => {
    for (const book of BOOKS) {
      expect(book.hebrew).not.toMatch(/[֑-֯]/);
    }
  });
});
