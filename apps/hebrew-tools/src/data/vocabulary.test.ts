import { describe, expect, it } from 'vitest';
import { TEXTBOOK_IDS } from './textbooks';
import { type HebrewVocabWord, vocabulary } from './vocabulary';

// Hebrew consonants (U+05D0-05EA) + nikud (U+05B0-05C7) + shin/sin dots
// (U+05C1-U+05C2). Cantillation is intentionally excluded — vocabulary entries
// should never contain te'amim.
const VALID_HEBREW_CHARS = /^[א-תְ-ׂ]+$/;
const VALID_ROOT_CHARS = /^[א-ת]{3}$/;

const VALID_GENDERS = new Set(['m', 'f', 'fm']);

const VALID_POS = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'particle',
]);

describe('vocabulary data', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(vocabulary)).toBe(true);
    expect(vocabulary.length).toBeGreaterThan(0);
  });

  it('every entry has a non-empty hebrew field', () => {
    vocabulary.forEach((word) => {
      expect(word.hebrew.trim().length).toBeGreaterThan(0);
    });
  });

  it('every hebrew field contains only valid Hebrew consonants and points', () => {
    vocabulary.forEach((word) => {
      expect(VALID_HEBREW_CHARS.test(word.hebrew), `Invalid characters in: ${word.hebrew}`).toBe(
        true,
      );
    });
  });

  it('every root, when present, is exactly three Hebrew consonants', () => {
    vocabulary.forEach((word) => {
      if (word.root !== undefined) {
        expect(VALID_ROOT_CHARS.test(word.root), `Invalid root: ${word.root}`).toBe(true);
      }
    });
  });

  it('every entry has a non-empty transliteration field', () => {
    vocabulary.forEach((word) => {
      expect(word.transliteration.trim().length).toBeGreaterThan(0);
    });
  });

  it('every entry has a non-empty gloss field', () => {
    vocabulary.forEach((word) => {
      expect(word.gloss.trim().length).toBeGreaterThan(0);
    });
  });

  it('every entry has a positive frequency', () => {
    vocabulary.forEach((word) => {
      expect(word.frequency).toBeGreaterThan(0);
    });
  });

  it('contains only known parts of speech', () => {
    vocabulary.forEach((word) => {
      expect(VALID_POS.has(word.partOfSpeech), `Unknown POS: ${word.partOfSpeech}`).toBe(true);
    });
  });

  it('every verb has a binyan set', () => {
    vocabulary
      .filter((word) => word.partOfSpeech === 'verb')
      .forEach((word) => {
        expect(word.binyan, `Verb missing binyan: ${word.hebrew}`).toBeDefined();
      });
  });

  it('has no duplicate hebrew entries', () => {
    const hebrewTerms = vocabulary.map((w) => w.hebrew);
    const uniqueTerms = new Set(hebrewTerms);
    expect(uniqueTerms.size).toBe(hebrewTerms.length);
  });

  it('includes the definite article and waw conjunction', () => {
    const hebrewTerms = vocabulary.map((w) => w.hebrew);
    expect(hebrewTerms).toContain('הַ');
    expect(hebrewTerms).toContain('וְ');
  });

  it('includes core theological vocabulary', () => {
    const hebrewTerms = vocabulary.map((w) => w.hebrew);
    expect(hebrewTerms).toContain('אֱלֹהִים');
    expect(hebrewTerms).toContain('יְהוָה');
  });

  it('every gender, when present, is one of m / f / fm', () => {
    vocabulary.forEach((word) => {
      if (word.gender !== undefined) {
        expect(VALID_GENDERS.has(word.gender), `Unknown gender: ${word.gender}`).toBe(true);
      }
    });
  });

  it('never sets a gender on a verb', () => {
    vocabulary
      .filter((word) => word.partOfSpeech === 'verb')
      .forEach((word) => {
        expect(word.gender, `Verb has a gender: ${word.hebrew}`).toBeUndefined();
      });
  });

  it('every chapter tag names a known textbook and a positive chapter', () => {
    vocabulary.forEach((word) => {
      (word.chapters ?? []).forEach((ref) => {
        expect(TEXTBOOK_IDS, `Unknown textbook on ${word.hebrew}`).toContain(ref.textbook);
        expect(ref.chapter, `Bad chapter on ${word.hebrew}`).toBeGreaterThan(0);
        expect(Number.isInteger(ref.chapter)).toBe(true);
      });
    });
  });

  it('never tags the same word with the same chapter twice', () => {
    vocabulary.forEach((word) => {
      const keys = (word.chapters ?? []).map((c) => `${c.textbook}:${c.chapter}`);
      expect(new Set(keys).size, `Duplicate chapter tag on ${word.hebrew}`).toBe(keys.length);
    });
  });

  it('HebrewVocabWord shape has all required fields', () => {
    const word: HebrewVocabWord = vocabulary[0];
    expect(Object.keys(word)).toEqual(
      expect.arrayContaining(['hebrew', 'transliteration', 'gloss', 'frequency', 'partOfSpeech']),
    );
  });
});
