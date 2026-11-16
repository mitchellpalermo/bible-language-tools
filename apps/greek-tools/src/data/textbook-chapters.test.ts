import { describe, expect, it } from 'vitest';
import { corpusWords, hasCorpus } from '../test/corpus';
import { CHAPTER_MAPS, TEXTBOOK_IDS } from './textbooks';
import { vocabulary } from './vocabulary-all';

// The chapter maps are typed in from a list outside the repository, so every
// claim they make is checked against data the repository does hold: the
// vocabulary (always) and MorphGNT (where the corpus has been built).

const byGreek = new Map<string, number>();
for (const word of vocabulary) byGreek.set(word.greek, (byGreek.get(word.greek) ?? 0) + 1);

/** Hand-kept entries: not MorphGNT lemmas. `vocabulary-all.test.ts` checks them. */
const supplemented = new Set(vocabulary.filter((w) => w.supplement).map((w) => w.greek));

const entries = TEXTBOOK_IDS.flatMap((textbook) =>
  Object.entries(CHAPTER_MAPS[textbook]).flatMap(([chapter, lemmas]) =>
    lemmas.map((lemma) => ({ textbook, chapter: Number(chapter), lemma })),
  ),
);

describe.each(TEXTBOOK_IDS)('the chapter map of %s', (textbook) => {
  const map = CHAPTER_MAPS[textbook];
  const mine = entries.filter((e) => e.textbook === textbook);

  it('numbers its chapters with positive integers and leaves none empty', () => {
    for (const [chapter, lemmas] of Object.entries(map)) {
      expect(Number.isInteger(Number(chapter)) && Number(chapter) > 0, chapter).toBe(true);
      expect(lemmas.length, `chapter ${chapter}`).toBeGreaterThan(0);
    }
  });

  it('names only words the vocabulary has, each exactly once there', () => {
    const missing = mine.filter((e) => byGreek.get(e.lemma) !== 1);
    expect(missing).toEqual([]);
  });

  it('lists no word twice in one chapter', () => {
    for (const [chapter, lemmas] of Object.entries(map)) {
      expect(new Set(lemmas).size, `chapter ${chapter}`).toBe(lemmas.length);
    }
  });

  // The content rule, as a test: a map holds lexical forms and nothing else.
  // A gloss, a cognate or a note pasted in beside a lemma fails here.
  it('holds Greek lexical forms only, with no English beside them', () => {
    const notGreek = mine.filter((e) => !/^[\p{Script=Greek}, ]+$/u.test(e.lemma));
    expect(notGreek).toEqual([]);
  });
});

describe('Beginning with New Testament Greek', () => {
  const map = CHAPTER_MAPS['beginning-with-nt-greek'];

  it('runs from chapter 1 to chapter 23 with no gap', () => {
    expect(Object.keys(map).map(Number)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
  });

  it('has all fifteen headwords of every chapter', () => {
    for (const [chapter, lemmas] of Object.entries(map)) {
      expect(lemmas.length, `chapter ${chapter}`).toBe(15);
    }
  });

  it('holds all 345 headwords, and no word sits in two chapters', () => {
    const lemmas = Object.values(map).flat();
    expect(lemmas).toHaveLength(345);
    expect(new Set(lemmas).size).toBe(345);
  });

  it('places the three hand-kept words in their chapters', () => {
    expect(map[2]).toContain('ἱερόν');
    expect(map[20]).toContain('δεῖ');
    expect(map[21]).toContain('ἐὰν μή');
    expect([...supplemented].sort()).toEqual(['δεῖ', 'ἐὰν μή', 'ἱερόν'].sort());
  });
});

// MorphGNT is where the vocabulary's lemmas come from, so this is a second
// witness that a map entry is a word of the Greek New Testament and not a
// typing slip. The vocabulary prints three lemmas in a display form (ὁ, ἡ, τό;
// ἐκ, ἐξ; οὕτως for MorphGNT's οὕτω(ς)), so an entry is attested when any of
// its comma-separated forms is a lemma, or a lemma without its brackets. The
// hand-kept words are not lemmas by definition; their counts are checked
// against the text in `vocabulary-all.test.ts` instead.
describe.skipIf(!hasCorpus)('the chapter maps against MorphGNT', () => {
  it('finds every generated lemma in the text', () => {
    const lemmas = new Set<string>();
    for (const word of corpusWords()) {
      lemmas.add(word.lemma);
      lemmas.add(word.lemma.replace(/[()]/g, ''));
    }
    const unattested = entries.filter(
      (e) => !supplemented.has(e.lemma) && !e.lemma.split(', ').some((form) => lemmas.has(form)),
    );
    expect(unattested).toEqual([]);
  });
});
