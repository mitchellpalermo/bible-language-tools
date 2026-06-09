import { describe, expect, it } from 'vitest';
import type { MorphBook } from '../data/morphgnt';
import type { VocabWord } from '../data/vocabulary';
import {
  buildVocabMap,
  extractPassageLemmas,
  formatPassageRef,
  GNT_BOOKS,
  isValidRef,
} from './passage-deck';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_VOCAB: VocabWord[] = [
  { greek: 'λόγος', gloss: 'word', frequency: 330, partOfSpeech: 'noun' },
  { greek: 'θεός', gloss: 'God', frequency: 1307, partOfSpeech: 'noun' },
  { greek: 'εἰμί', gloss: 'I am', frequency: 2456, partOfSpeech: 'verb' },
  { greek: 'καί', gloss: 'and', frequency: 8973, partOfSpeech: 'conjunction' },
  { greek: 'ὁ, ἡ, τό', gloss: 'the', frequency: 19769, partOfSpeech: 'article' },
];

// chapter 1: verses 1–3; chapter 2: verse 1
const MOCK_BOOK: MorphBook = {
  '1': {
    '1': [
      { text: 'Λόγος', lemma: 'λόγος', pos: 'N-', parsing: '--------' },
      { text: 'θεός', lemma: 'θεός', pos: 'N-', parsing: '--------' },
    ],
    '2': [
      { text: 'εἰμί', lemma: 'εἰμί', pos: 'V-', parsing: '--------' },
      { text: 'λόγος,', lemma: 'λόγος', pos: 'N-', parsing: '--------' }, // duplicate
    ],
    '3': [
      { text: 'καί', lemma: 'καί', pos: 'C-', parsing: '--------' },
      { text: 'ξένος', lemma: 'ξένος', pos: 'A-', parsing: '--------' }, // not in MOCK_VOCAB
    ],
  },
  '2': {
    '1': [
      { text: 'ὁ', lemma: 'ὁ', pos: 'RA', parsing: '--------' },
      { text: 'καί', lemma: 'καί', pos: 'C-', parsing: '--------' }, // cross-chapter duplicate
    ],
  },
};

// ─── buildVocabMap ────────────────────────────────────────────────────────────

describe('buildVocabMap', () => {
  it('maps normalizeKey(greek) → VocabWord', () => {
    const map = buildVocabMap(MOCK_VOCAB);
    expect(map.get('λόγος')?.gloss).toBe('word');
    expect(map.get('θεός')?.gloss).toBe('God');
  });

  it('strips compound form for article', () => {
    const map = buildVocabMap(MOCK_VOCAB);
    expect(map.get('ὁ')?.gloss).toBe('the');
    expect(map.has('ὁ, ἡ, τό')).toBe(false);
  });

  it('returns an empty map for empty input', () => {
    expect(buildVocabMap([]).size).toBe(0);
  });

  it('contains all provided words', () => {
    const map = buildVocabMap(MOCK_VOCAB);
    expect(map.size).toBe(MOCK_VOCAB.length);
  });
});

// ─── isValidRef ───────────────────────────────────────────────────────────────

describe('isValidRef', () => {
  it('returns true for a valid chapter and verse', () => {
    expect(isValidRef(MOCK_BOOK, 1, 1)).toBe(true);
    expect(isValidRef(MOCK_BOOK, 1, 3)).toBe(true);
    expect(isValidRef(MOCK_BOOK, 2, 1)).toBe(true);
  });

  it('returns false for a chapter that does not exist', () => {
    expect(isValidRef(MOCK_BOOK, 3, 1)).toBe(false);
    expect(isValidRef(MOCK_BOOK, 0, 1)).toBe(false);
  });

  it('returns false for a verse that does not exist in a valid chapter', () => {
    expect(isValidRef(MOCK_BOOK, 1, 4)).toBe(false);
    expect(isValidRef(MOCK_BOOK, 2, 2)).toBe(false);
  });
});

// ─── extractPassageLemmas ────────────────────────────────────────────────────

describe('extractPassageLemmas', () => {
  const vocabMap = buildVocabMap(MOCK_VOCAB);

  it('returns lemmas for a single verse in passage order', () => {
    expect(extractPassageLemmas(MOCK_BOOK, 1, 1, 1, 1, vocabMap)).toEqual(['λόγος', 'θεός']);
  });

  it('deduplicates lemmas across verses, keeping first occurrence', () => {
    const result = extractPassageLemmas(MOCK_BOOK, 1, 1, 1, 2, vocabMap);
    expect(result.filter((k) => k === 'λόγος')).toHaveLength(1);
    expect(result.indexOf('λόγος')).toBe(0);
  });

  it('excludes lemmas not in vocabMap', () => {
    const result = extractPassageLemmas(MOCK_BOOK, 1, 3, 1, 3, vocabMap);
    expect(result).toContain('καί');
    expect(result).not.toContain('ξένος');
  });

  it('covers a multi-verse single-chapter range', () => {
    const result = extractPassageLemmas(MOCK_BOOK, 1, 1, 1, 3, vocabMap);
    expect(result).toContain('λόγος');
    expect(result).toContain('θεός');
    expect(result).toContain('εἰμί');
    expect(result).toContain('καί');
    expect(result).not.toContain('ξένος');
  });

  it('covers a cross-chapter range', () => {
    const result = extractPassageLemmas(MOCK_BOOK, 1, 3, 2, 1, vocabMap);
    expect(result).toContain('καί');
    expect(result).toContain('ὁ');
    expect(result.filter((k) => k === 'καί')).toHaveLength(1);
  });

  it('deduplicates lemmas across chapter boundary', () => {
    const result = extractPassageLemmas(MOCK_BOOK, 1, 1, 2, 1, vocabMap);
    expect(result.filter((k) => k === 'καί')).toHaveLength(1);
  });

  it('respects the start verse boundary', () => {
    const result = extractPassageLemmas(MOCK_BOOK, 1, 2, 1, 2, vocabMap);
    expect(result).toContain('εἰμί');
    expect(result).not.toContain('θεός');
  });

  it('respects the end verse boundary', () => {
    const result = extractPassageLemmas(MOCK_BOOK, 1, 1, 1, 1, vocabMap);
    expect(result).not.toContain('εἰμί');
    expect(result).not.toContain('καί');
  });

  it('returns an empty array when no lemmas match vocab', () => {
    const emptyBook: MorphBook = {
      '1': { '1': [{ text: 'ξένος', lemma: 'ξένος', pos: 'A-', parsing: '--------' }] },
    };
    expect(extractPassageLemmas(emptyBook, 1, 1, 1, 1, vocabMap)).toEqual([]);
  });

  it('handles a book with only one verse', () => {
    const tiny: MorphBook = {
      '1': { '1': [{ text: 'θεός', lemma: 'θεός', pos: 'N-', parsing: '--------' }] },
    };
    expect(extractPassageLemmas(tiny, 1, 1, 1, 1, vocabMap)).toEqual(['θεός']);
  });
});

// ─── formatPassageRef ─────────────────────────────────────────────────────────

describe('formatPassageRef', () => {
  it('formats a single verse', () => {
    expect(formatPassageRef('John', 3, 16, 3, 16)).toBe('John 3:16');
  });

  it('formats a same-chapter range', () => {
    expect(formatPassageRef('John', 3, 1, 3, 21)).toBe('John 3:1–21');
  });

  it('formats a cross-chapter range', () => {
    expect(formatPassageRef('Romans', 8, 35, 9, 5)).toBe('Romans 8:35–9:5');
  });

  it('uses the book name as provided', () => {
    expect(formatPassageRef('1 Corinthians', 13, 1, 13, 13)).toBe('1 Corinthians 13:1–13');
  });
});

// ─── GNT_BOOKS ───────────────────────────────────────────────────────────────

describe('GNT_BOOKS', () => {
  it('contains 27 books', () => {
    expect(GNT_BOOKS).toHaveLength(27);
  });

  it('starts with Matthew and ends with Revelation', () => {
    expect(GNT_BOOKS[0].code).toBe('MAT');
    expect(GNT_BOOKS[26].code).toBe('REV');
  });

  it('has unique codes', () => {
    const codes = GNT_BOOKS.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
