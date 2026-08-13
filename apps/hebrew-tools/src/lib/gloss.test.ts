import { describe, expect, it } from 'vitest';
import type { LemmaIndex } from '../data/morphhb';
import { vocabulary } from '../data/vocabulary';
import { glossFor } from './gloss';

/** The eight lemma keys that are letter codes rather than Strong's numbers. */
const PREFIX_KEYS = ['b', 'c', 'd', 'i', 'k', 'l', 'm', 's'];

const lemmas: LemmaIndex = {
  '4191': { count: 836, hebrew: 'מוּת', gloss: 'die, kill' },
  '5650': { count: 800, hebrew: 'עֶבֶד', gloss: 'servant' },
  // Strong's wording for חֶסֶד, which the course words differently.
  '2617a': { count: 245, hebrew: 'חֶסֶד', gloss: 'kindness, favour' },
  // מֶלֶךְ is a lexeme the course teaches through an inflected card, מְלָכִים.
  '4428': { count: 2530, hebrew: 'מֶלֶךְ', gloss: 'king' },
  '9999': { count: 1, hebrew: 'לֹא־מִלָּה' },
};

describe('glossFor', () => {
  it('reads a gloss out of the lemma index', () => {
    expect(glossFor('4191', lemmas)).toBe('die, kill');
    expect(glossFor('5650', lemmas)).toBe('servant');
  });

  it('has nothing to say about a lemma with no gloss', () => {
    expect(glossFor('9999', lemmas)).toBeUndefined();
    expect(glossFor('4191', null)).toBeUndefined();
  });

  // The textbook is the answer key for the deck built from the textbook, where
  // a quiz is marked against the page. It is not a general-purpose lexicon, and
  // letting it win here would make a word's meaning depend on whether a course
  // happened to teach it.
  describe('the textbook does not reach the reader', () => {
    it('keeps the lexicon wording for a word the course also teaches', () => {
      const course = vocabulary.find((w) => w.strong === '2617a');
      expect(course?.gloss).toBeDefined();
      expect(course?.gloss).not.toBe('kindness, favour');
      expect(glossFor('2617a', lemmas)).toBe('kindness, favour');
    });

    it('never lets a card front a lemma with the gloss of an inflected form', () => {
      // מְלָכִים is "kings"; a reader hovering מֶלֶךְ wants "king".
      expect(vocabulary.find((w) => w.strong === '4428')?.gloss).toBe('kings');
      expect(glossFor('4428', lemmas)).toBe('king');
    });

    it('answers for no course word the index has not glossed', () => {
      // The vocabulary module is not consulted, so a taught word the index
      // knows nothing about gets nothing — prefixes excepted, since those have
      // no lexicon entry to know anything.
      const taught = vocabulary.filter(
        (w) => w.strong && !(w.strong in lemmas) && !PREFIX_KEYS.includes(w.strong),
      );
      expect(taught.length).toBeGreaterThan(100);
      for (const word of taught) {
        expect(glossFor(word.strong as string, lemmas), `${word.hebrew} leaked`).toBeUndefined();
      }
    });
  });

  describe('the inseparable prefixes', () => {
    // None of the eight has a Strong's entry — they are letter codes, not
    // numbers — and between them they are 121,669 of the corpus's 305,516
    // tokens, so a blank popup on a ל is not an option.
    it.each(PREFIX_KEYS)('glosses %s without the lemma index', (prefix) => {
      const gloss = glossFor(prefix);
      expect(gloss, `no gloss for the prefix ${prefix}`).toBeDefined();
      expect(gloss).not.toBe('');
    });

    it('reads them the way a lexicon does', () => {
      expect(glossFor('c')).toBe('and');
      expect(glossFor('d')).toBe('the');
      expect(glossFor('l')).toBe('to, for');
      expect(glossFor('m')).toBe('from, out of');
    });

    it('still prefers the index where the index has something', () => {
      expect(glossFor('d', { d: { count: 1, gloss: 'from the lexicon' } })).toBe(
        'from the lexicon',
      );
    });
  });
});
