import { normalizeKey } from '@tools/shared/srs';
import { describe, expect, it } from 'vitest';
import { corpusWords, hasCorpus } from '../test/corpus';
import { CHAPTER_MAPS, TEXTBOOK_IDS } from './textbooks';
import { vocabulary as generated } from './vocabulary';
import { mergeVocabulary, vocabulary } from './vocabulary-all';
import { TEXTBOOK_SUPPLEMENT } from './vocabulary-textbook';

// The hand-kept textbook supplement, and its merge into the vocabulary.

const generatedKeys = new Set(generated.map((w) => normalizeKey(w.greek)));
const supplementKeys = TEXTBOOK_SUPPLEMENT.map((w) => normalizeKey(w.greek));

describe('the textbook supplement', () => {
  it('is exactly the three approved entries', () => {
    // Approval was for these three (Nov 2026). A fourth needs its own.
    expect(
      TEXTBOOK_SUPPLEMENT.map(({ greek, gloss, frequency, partOfSpeech }) => ({
        greek,
        gloss,
        frequency,
        partOfSpeech,
      })),
    ).toEqual([
      { greek: 'ἱερόν', gloss: 'a temple', frequency: 71, partOfSpeech: 'noun' },
      { greek: 'δεῖ', gloss: 'it is necessary, inevitable', frequency: 101, partOfSpeech: 'verb' },
      { greek: 'ἐὰν μή', gloss: 'unless', frequency: 47, partOfSpeech: 'conjunction' },
    ]);
  });

  // If this fails, the generator has begun producing the word itself. Delete
  // the entry from `vocabulary-textbook.ts`: the student's card is stored under
  // the same key and carries over to the generated entry.
  it('holds no word the generated vocabulary has, by spelling or by SRS key', () => {
    const shadowed = TEXTBOOK_SUPPLEMENT.filter(
      (w) => generatedKeys.has(normalizeKey(w.greek)) || generated.some((g) => g.greek === w.greek),
    );
    expect(shadowed).toEqual([]);
  });

  it('gives every entry its own SRS key, which is its headword', () => {
    expect(new Set(supplementKeys).size).toBe(supplementKeys.length);
    expect(supplementKeys).toEqual(TEXTBOOK_SUPPLEMENT.map((w) => w.greek));
  });

  it('says where each entry came from, naming a real textbook that lists it', () => {
    for (const word of TEXTBOOK_SUPPLEMENT) {
      const { textbook, gloss, count } = word.supplement;
      expect(TEXTBOOK_IDS as string[]).toContain(textbook);
      const listed = Object.values(CHAPTER_MAPS[textbook as (typeof TEXTBOOK_IDS)[number]]).flat();
      expect(listed, word.greek).toContain(word.greek);
      expect(['dodson', 'textbook']).toContain(gloss);
      expect(count.length).toBeGreaterThan(0);
    }
  });

  it('keeps each gloss short: a gloss, not a note', () => {
    for (const word of TEXTBOOK_SUPPLEMENT) {
      expect(word.gloss.length, word.greek).toBeLessThanOrEqual(40);
      expect(word.gloss, word.greek).not.toMatch(/[()—]/);
    }
  });

  it('uses the parts of speech the filters know', () => {
    const known = new Set(generated.map((w) => w.partOfSpeech));
    for (const word of TEXTBOOK_SUPPLEMENT) expect(known).toContain(word.partOfSpeech);
  });
});

describe('the merged vocabulary', () => {
  it('is the generated list plus the supplement, each word once', () => {
    expect(vocabulary).toHaveLength(generated.length + TEXTBOOK_SUPPLEMENT.length);
    for (const word of TEXTBOOK_SUPPLEMENT) {
      expect(vocabulary.filter((w) => w.greek === word.greek)).toEqual([word]);
    }
    const keys = vocabulary.map((w) => normalizeKey(w.greek));
    const generatedDuplicates = generated.length - generatedKeys.size;
    expect(keys.length - new Set(keys).size).toBe(generatedDuplicates);
  });

  it('leaves the generated words as they are and in their order', () => {
    expect(vocabulary.filter((w) => !w.supplement)).toEqual(generated);
    expect(vocabulary.filter((w) => w.supplement)).toHaveLength(TEXTBOOK_SUPPLEMENT.length);
  });

  it('stays most frequent first', () => {
    const counts = vocabulary.map((w) => w.frequency);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('survives a regenerated list of another length', () => {
    // The merge reads whatever the generator wrote; nothing is positional.
    const smaller = generated.slice(0, 10);
    const merged = mergeVocabulary(smaller, TEXTBOOK_SUPPLEMENT);
    expect(merged).toHaveLength(13);
    expect(merged.slice(0, 10)).toEqual(smaller);
    expect(mergeVocabulary([], TEXTBOOK_SUPPLEMENT).map((w) => w.frequency)).toEqual([101, 71, 47]);
  });
});

// Each count is a count of something in MorphGNT, by the rule its entry
// states. Recounted here so a number cannot drift from the text.
describe.skipIf(!hasCorpus)('the supplement counts against MorphGNT', () => {
  const count = (greek: string) => TEXTBOOK_SUPPLEMENT.find((w) => w.greek === greek)?.frequency;

  it('finds none of the three as a lemma, which is why they are hand-kept', () => {
    const lemmas = new Set(corpusWords().map((w) => w.lemma));
    for (const word of TEXTBOOK_SUPPLEMENT) expect(lemmas.has(word.greek), word.greek).toBe(false);
  });

  it('counts ἱερόν as the neuter singular forms filed under ἱερός', () => {
    // Parse positions 5 and 6 are number and gender. The two neuter plurals
    // under the lemma are the adjective, not the temple.
    const n = corpusWords().filter(
      (w) => w.lemma === 'ἱερός' && w.parsing[5] === 'S' && w.parsing[6] === 'N',
    ).length;
    expect(n).toBe(count('ἱερόν'));
  });

  it('counts δεῖ as the present and imperfect active forms filed under δέω', () => {
    // Positions 1 and 2 are tense and voice. δέω "bind" has no present or
    // imperfect active in the text, and δέομαι's forms are middle.
    const forms = corpusWords().filter(
      (w) => w.lemma === 'δέω' && 'PI'.includes(w.parsing[1]) && w.parsing[2] === 'A',
    );
    expect(forms.length).toBe(count('δεῖ'));
  });

  it('counts ἐὰν μή as ἐάν directly followed by μή', () => {
    // `corpusWords` runs verse after verse, so a pair could in principle span
    // two verses. None does: every ἐάν that μή follows is followed in its verse.
    const words = corpusWords();
    const n = words.filter((w, i) => w.lemma === 'ἐάν' && words[i + 1]?.lemma === 'μή').length;
    expect(n).toBe(count('ἐὰν μή'));
  });
});

// A module that deals cards from the generated list alone would silently lack
// the three hand-kept words: no error, just a chapter of fourteen.
describe('who reads which list', () => {
  const sources = import.meta.glob(
    ['../components/*.tsx', '../lib/*.ts', './*.ts', '!../**/*.test.*', '!./*.test.ts'],
    { query: '?raw', import: 'default', eager: true },
  ) as Record<string, string>;
  const importsGenerated = (src: string) => /from '\.{1,2}\/(data\/)?vocabulary'/.test(src);

  it('has every card-dealing module import the merged vocabulary', () => {
    for (const file of [
      '../components/Flashcards.tsx',
      '../components/DeckBuilder.tsx',
      '../components/TodaySession.tsx',
      '../lib/today.ts',
      './textbooks.ts',
    ]) {
      expect(sources[file], file).toBeDefined();
      expect(sources[file], file).toMatch(/vocabulary-all'/);
      expect(importsGenerated(sources[file]), file).toBe(false);
    }
  });

  it('leaves the generated list to the modules that look a MorphGNT lemma up', () => {
    const readers = Object.keys(sources).filter((file) => importsGenerated(sources[file]));
    expect(readers.sort()).toEqual(
      [
        '../components/FocusPassageNew.tsx',
        '../components/FocusPassageProgress.tsx',
        '../components/FocusPassageVocab.tsx',
        '../lib/book-deck.ts',
        '../lib/passage-deck.ts',
        '../lib/vocab-lookup.ts',
        './vocabulary-all.ts',
        './vocabulary-textbook.ts',
      ].sort(),
    );
  });
});
