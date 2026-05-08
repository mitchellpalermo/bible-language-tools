import { describe, expect, it } from 'vitest';
import { type VocabWord, vocabulary } from './vocabulary';

describe('vocabulary data', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(vocabulary)).toBe(true);
    expect(vocabulary.length).toBeGreaterThan(0);
  });

  it('covers all GNT lemmas (generated from MorphGNT + Dodson)', () => {
    expect(vocabulary.length).toBeGreaterThan(4000);
  });

  it('every entry has a non-empty greek field', () => {
    vocabulary.forEach((word) => {
      expect(word.greek.trim().length).toBeGreaterThan(0);
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

  it('every entry has a non-empty partOfSpeech field', () => {
    vocabulary.forEach((word) => {
      expect(word.partOfSpeech.trim().length).toBeGreaterThan(0);
    });
  });

  it('has no duplicate greek entries', () => {
    const greekTerms = vocabulary.map((w) => w.greek);
    const uniqueTerms = new Set(greekTerms);
    expect(uniqueTerms.size).toBe(greekTerms.length);
  });

  it('contains only known parts of speech', () => {
    const validPOS = new Set([
      'noun',
      'verb',
      'pronoun',
      'adjective',
      'adverb',
      'preposition',
      'conjunction',
      'article',
      'particle',
    ]);
    vocabulary.forEach((word) => {
      expect(
        validPOS.has(word.partOfSpeech),
        `Unknown POS: ${word.partOfSpeech} for ${word.greek}`,
      ).toBe(true);
    });
  });

  it('includes high-frequency words like ὁ/ἡ/τό (the)', () => {
    const article = vocabulary.find((w) => w.greek === 'ὁ, ἡ, τό');
    expect(article).toBeDefined();
    expect(article?.frequency).toBeGreaterThan(10000);
  });

  it('includes theological key terms', () => {
    const greekTerms = vocabulary.map((w) => w.greek);
    expect(greekTerms).toContain('θεός');
    expect(greekTerms).toContain('πίστις');
    expect(greekTerms).toContain('ἀγάπη');
  });

  it('VocabWord shape has all required fields', () => {
    const word: VocabWord = vocabulary[0];
    expect(Object.keys(word)).toEqual(
      expect.arrayContaining(['greek', 'gloss', 'frequency', 'partOfSpeech']),
    );
  });
});
