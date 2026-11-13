import { describe, expect, it } from 'vitest';
import { type HebrewVocabWord, vocabulary } from '../data/vocabulary';
import {
  hasFilters,
  matchesFilters,
  NO_FILTERS,
  partOfSpeechCounts,
  ROOT_SEARCH_LIMIT,
  ROOT_SUGGESTIONS,
  rootChoices,
  rootCounts,
  rootSearchKey,
  toggled,
} from './flashcard-filters';

const w = (hebrew: string, partOfSpeech: string, root?: string): HebrewVocabWord => ({
  hebrew,
  gloss: 'x',
  partOfSpeech,
  root,
});

const WORDS = [
  w('מֶלֶךְ', 'noun', 'מלך'),
  w('מָלַךְ', 'verb', 'מלך'),
  w('מַלְכָּה', 'noun', 'מלך'),
  w('שָׁמַע', 'verb', 'שׁמע'),
  w('אָמַר', 'verb', 'אמר'),
  w('וְ', 'conjunction'),
];

describe('matchesFilters', () => {
  it('keeps everything when nothing is chosen', () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(WORDS.every((word) => matchesFilters(word, NO_FILTERS))).toBe(true);
  });

  it('keeps the chosen parts of speech', () => {
    const filters = { partsOfSpeech: ['noun', 'conjunction'], roots: [] };
    expect(hasFilters(filters)).toBe(true);
    expect(WORDS.filter((word) => matchesFilters(word, filters)).map((x) => x.hebrew)).toEqual([
      'מֶלֶךְ',
      'מַלְכָּה',
      'וְ',
    ]);
  });

  it('keeps the chosen roots, and never a word with no root', () => {
    const filters = { partsOfSpeech: [], roots: ['מלך', 'אמר'] };
    expect(WORDS.filter((word) => matchesFilters(word, filters))).toHaveLength(4);
    expect(matchesFilters(WORDS[5], filters)).toBe(false);
  });

  it('applies both together', () => {
    const filters = { partsOfSpeech: ['verb'], roots: ['מלך'] };
    expect(WORDS.filter((word) => matchesFilters(word, filters)).map((x) => x.hebrew)).toEqual([
      'מָלַךְ',
    ]);
  });
});

describe('toggled', () => {
  it('adds a value that is absent and removes one that is present', () => {
    expect(toggled(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggled(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('partOfSpeechCounts', () => {
  it('counts what the deck holds, open classes first', () => {
    expect(partOfSpeechCounts(WORDS)).toEqual([
      { value: 'noun', count: 2 },
      { value: 'verb', count: 3 },
      { value: 'conjunction', count: 1 },
    ]);
  });

  it('lists a part of speech it has no place for last, alphabetically', () => {
    const counts = partOfSpeechCounts([w('א', 'zebra'), w('ב', 'article'), w('ג', 'noun')]);
    expect(counts.map((c) => c.value)).toEqual(['noun', 'article', 'zebra']);
  });

  it('knows a place for every part of speech in the vocabulary', () => {
    const counts = partOfSpeechCounts(vocabulary);
    expect(counts[0].value).toBe('noun');
    expect(counts.reduce((sum, c) => sum + c.count, 0)).toBe(vocabulary.length);
  });
});

describe('rootCounts', () => {
  it('lists the largest word family first and skips words with no root', () => {
    const counts = rootCounts(WORDS);
    expect(counts[0]).toEqual({ value: 'מלך', count: 3 });
    expect(counts).toHaveLength(3);
  });

  it('reads roots off the vocabulary: consonants only, with a shin or sin dot', () => {
    const counts = rootCounts(vocabulary);
    expect(counts.length).toBeGreaterThan(200);
    for (const { value } of counts) expect(value).toMatch(/^[א-תׁׂ]+$/);
  });
});

describe('rootSearchKey', () => {
  it('drops the shin dot and any pointing', () => {
    expect(rootSearchKey('שׁמע')).toBe('שמע');
    expect(rootSearchKey('שָׁמַע')).toBe('שמע');
  });

  it('reads a final form as the letter it is, and ignores spaces', () => {
    expect(rootSearchKey('מלך')).toBe('מלכ');
    expect(rootSearchKey(' אם ')).toBe('אמ');
  });
});

describe('rootChoices', () => {
  const roots = rootCounts(WORDS);

  it('offers only word families before anything is typed', () => {
    expect(rootChoices(roots, '', []).map((r) => r.value)).toEqual(['מלך']);
  });

  it('caps the suggestions', () => {
    const many = rootCounts(vocabulary);
    expect(rootChoices(many, '', [])).toHaveLength(ROOT_SUGGESTIONS);
    expect(rootChoices(many, 'א', []).length).toBeLessThanOrEqual(ROOT_SEARCH_LIMIT);
  });

  it('finds a single-word root by typing it, mid-word finals and missing dots included', () => {
    // אמ shows as אם in the field on the way to אמר.
    expect(rootChoices(roots, 'אם', []).map((r) => r.value)).toEqual(['אמר']);
    expect(rootChoices(roots, 'שמ', []).map((r) => r.value)).toEqual(['שׁמע']);
  });

  it('lists roots that begin with the query ahead of ones that contain it', () => {
    expect(rootChoices(roots, 'מ', []).map((r) => r.value)).toEqual(['מלך', 'אמר', 'שׁמע']);
  });

  it('keeps a selected root listed, first, even when the deck no longer has it', () => {
    expect(rootChoices(roots, '', ['אמר', 'כתב'])).toEqual([
      { value: 'אמר', count: 1 },
      { value: 'כתב', count: 0 },
      { value: 'מלך', count: 3 },
    ]);
  });

  it('finds nothing for a root the deck does not have', () => {
    expect(rootChoices(roots, 'קטל', [])).toEqual([]);
  });
});
