import { beforeEach, describe, expect, it } from 'vitest';
import type { LemmaIndex } from '../data/morphhb';
import { vocabulary } from '../data/vocabulary';
import { clearGlossCache, glossFor } from './gloss';

const lemmas: LemmaIndex = {
  // Not course vocabulary — nothing curated can be shadowing these.
  '4191': { count: 836, hebrew: 'מוּת', gloss: 'die, kill' },
  '5650': { count: 800, hebrew: 'עֶבֶד', gloss: 'servant' },
  // The corpus's own wording for חֶסֶד, which the course words differently.
  '2617a': { count: 245, hebrew: 'חֶסֶד', gloss: 'kindness, favour' },
  // מֶלֶךְ is a lexeme the course teaches only through an inflected card.
  '4428': { count: 2530, hebrew: 'מֶלֶךְ', gloss: 'king' },
  '9999': { count: 1, hebrew: 'לֹא־מִלָּה' },
};

beforeEach(clearGlossCache);

describe('glossFor', () => {
  it('reads a gloss out of the lemma index', () => {
    expect(glossFor('4191', lemmas)).toBe('die, kill');
    expect(glossFor('5650', lemmas)).toBe('servant');
  });

  // The rule the vocabulary build already follows for the flashcard side: a
  // retyped handout is the best authority on what the course expects, and the
  // quiz is marked against Garrett rather than against Strong's.
  it('prefers the course wording over the lexicon where the course has an entry', () => {
    const course = vocabulary.find((w) => w.strong === '2617a');
    expect(course).toBeDefined();
    expect(glossFor('2617a', lemmas)).toBe(course?.gloss);
    expect(glossFor('2617a', lemmas)).not.toBe('kindness, favour');
  });

  it('glosses a course word before the lemma index has loaded', () => {
    expect(glossFor('2617a', null)).toBe(vocabulary.find((w) => w.strong === '2617a')?.gloss);
    expect(glossFor('2617a')).toBeDefined();
  });

  it('has nothing to say about a lemma no source covers', () => {
    expect(glossFor('9999', lemmas)).toBeUndefined();
    expect(glossFor('4191', null)).toBeUndefined();
  });

  describe('the inseparable prefixes', () => {
    // None of the eight has a Strong's entry — they are letter codes, not
    // numbers — so every one of them has to come from this side of the join.
    it.each(['b', 'c', 'd', 'i', 'k', 'l', 'm', 's'])('glosses %s', (prefix) => {
      const gloss = glossFor(prefix, lemmas);
      expect(gloss, `no gloss for the prefix ${prefix}`).toBeDefined();
      expect(gloss).not.toBe('');
    });

    it('takes six of them from the course vocabulary and two from its own table', () => {
      // The article and the conjunction are taught words; the reader must show
      // the same wording the flashcard does.
      expect(glossFor('d')).toBe(vocabulary.find((w) => w.strong === 'd')?.gloss);
      expect(glossFor('c')).toBe(vocabulary.find((w) => w.strong === 'c')?.gloss);
      // מִ and שֶׁ are neither taught as prefixes nor in Strong's.
      expect(vocabulary.some((w) => w.strong === 'm' || w.strong === 's')).toBe(false);
      expect(glossFor('m')).toBe('from, out of');
      expect(glossFor('s')).toBe('that, which, who');
    });
  });

  // An Inflected or Reading card's front is a form from a passage, so its gloss
  // is a gloss of that form. מְלָכִים is "kings", and a reader hovering מֶלֶךְ wants
  // "king" — which only Strong's is in a position to say.
  describe('cards whose front is a form rather than a lexeme', () => {
    it('does not let a plural card gloss its singular lemma', () => {
      const inflected = vocabulary.find((w) => w.strong === '4428');
      expect(inflected).toMatchObject({ hebrew: 'מְלָכִים', gloss: 'kings' });
      expect(inflected?.frequency).toBeUndefined();
      expect(glossFor('4428', lemmas)).toBe('king');
      expect(glossFor('4428', null)).toBeUndefined();
    });

    it('takes no gloss from any card that carries no frequency', () => {
      const formCards = vocabulary.filter((w) => w.strong && w.frequency === undefined);
      expect(formCards.length).toBeGreaterThan(50);
      for (const card of formCards) {
        const citation = vocabulary.some(
          (w) => w.strong === card.strong && w.frequency !== undefined,
        );
        if (!citation) {
          expect(glossFor(card.strong as string), `${card.hebrew} glossed its lemma`).not.toBe(
            card.gloss,
          );
        }
      }
    });
  });

  it('answers from a cache that survives being cleared', () => {
    const first = glossFor('d');
    clearGlossCache();
    expect(glossFor('d')).toBe(first);
  });
});
