import { describe, expect, it } from 'vitest';
import type { GlossIndex, HebrewWord, LemmaIndex } from '../data/morphhb';
import { vocabulary } from '../data/vocabulary';
import { glossFor, LINE_MAX, lineGloss, stemOf, stemSenses } from './gloss';

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
  it('reads Strong’s out of the lemma index when the BDB glosses have not loaded', () => {
    expect(glossFor('4191', { lemmas })).toBe('die, kill');
    expect(glossFor('5650', { lemmas })).toBe('servant');
  });

  it('has nothing to say about a lemma with no gloss', () => {
    expect(glossFor('9999', { lemmas })).toBeUndefined();
    expect(glossFor('4191', { lemmas: null })).toBeUndefined();
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
      expect(glossFor('2617a', { lemmas })).toBe('kindness, favour');
    });

    it('never lets a card front a lemma with the gloss of an inflected form', () => {
      // מְלָכִים is "kings"; a reader hovering מֶלֶךְ wants "king".
      expect(vocabulary.find((w) => w.strong === '4428')?.gloss).toBe('kings');
      expect(glossFor('4428', { lemmas })).toBe('king');
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
        expect(
          glossFor(word.strong as string, { lemmas }),
          `${word.hebrew} leaked`,
        ).toBeUndefined();
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
      expect(glossFor('d', { lemmas: { d: { count: 1, gloss: 'from the lexicon' } } })).toBe(
        'from the lexicon',
      );
    });
  });
});

// Real shapes, from the built glosses.json.
const glosses: GlossIndex = {
  '1571': { g: ['also', 'moreover', 'yea'] },
  '4399': { g: ['occupation', 'work'] },
  '853': { g: ['mark of the accusative'] },
  '2388': {
    g: ['be or grow firm', 'strong', 'strengthen'],
    s: {
      Qal: [['be or grow strong']],
      Hiphil: [['make strong', 'strengthen'], ['make firm']],
    },
  },
  '7069': { g: ['get', 'acquire'], s: { Qal: [['get', 'acquire'], ['buy']] } },
  '8085': { g: ['hear'], s: { Niphal: [['be heard']] } },
  '7586': { g: ['šāʾûl'] },
};

/** A word as the corpus stores it. */
const w = (lemma: string, parsing: string, text = 'x'): HebrewWord => ({
  text,
  lemma,
  pos: '',
  parsing,
});

describe('glossFor, with BDB', () => {
  it('prefers BDB’s short gloss to Strong’s', () => {
    const strongs: LemmaIndex = { '1571': { count: 769, gloss: 'assemblage, also, even' } };
    expect(glossFor('1571', { glosses, lemmas: strongs })).toBe('also, moreover, yea');
  });

  it('falls back to Strong’s for a lemma BDB has nothing on', () => {
    expect(glossFor('5650', { glosses, lemmas })).toBe('servant');
  });

  it('leaves the prefixes to the prefix table, which BDB does not reach', () => {
    expect(glossFor('c', { glosses })).toBe('and');
  });
});

describe('stemOf', () => {
  it('names the binyan of the verb in a word', () => {
    expect(stemOf(w('2388', 'HVhp1cs'))).toBe('Hiphil');
    expect(stemOf(w('559', 'HC/Vqw3ms', 'וַ/יֹּאמֶר'))).toBe('Qal');
  });

  it('reads an Aramaic stem as Aramaic', () => {
    expect(stemOf(w('1', 'AVpp3ms'))).toBe('Pael');
  });

  it('has nothing for a word with no verb', () => {
    expect(stemOf(w('4399', 'HR/Ncfsc', 'בִּ/מְלֶאכֶת'))).toBeUndefined();
  });
});

describe('stemSenses', () => {
  it('lists BDB’s senses for one stem', () => {
    expect(stemSenses('2388', 'Hiphil', glosses)).toEqual([
      ['make strong', 'strengthen'],
      ['make firm'],
    ]);
  });

  it('has nothing for a stem BDB does not list, a non-verb or a missing index', () => {
    expect(stemSenses('2388', 'Niphal', glosses)).toBeUndefined();
    expect(stemSenses('2388', undefined, glosses)).toBeUndefined();
    expect(stemSenses('1571', 'Qal', glosses)).toBeUndefined();
    expect(stemSenses('2388', 'Hiphil', null)).toBeUndefined();
  });
});

describe('lineGloss', () => {
  it('reads Nehemiah 5:16’s words the way BDB does, not Strong’s', () => {
    expect(lineGloss(w('1571', 'HC/D', 'וְ/גַם'), glosses)).toBe('also, moreover');
    expect(lineGloss(w('4399', 'HR/Ncfsc', 'בִּ/מְלֶאכֶת'), glosses)).toBe('occupation, work');
    expect(lineGloss(w('7069', 'HVqp1cp'), glosses)).toBe('get, acquire');
  });

  it('gives a verb its stem’s first sense', () => {
    // הֶחֱזַקְתִּי is a Hiphil: "make strong", not the Qal's "be or grow firm"
    expect(lineGloss(w('2388', 'HVhp1cs'), glosses)).toBe('make strong');
    expect(lineGloss(w('2388', 'HVqp3ms'), glosses)).toBe('be or grow strong');
  });

  it('falls back to the lemma’s gloss for a stem BDB says nothing about', () => {
    expect(lineGloss(w('2388', 'HVNp3ms'), glosses)).toBe('be or grow firm');
    expect(lineGloss(w('8085', 'HVqp3ms'), glosses)).toBe('hear');
  });

  it('drops to one item when two would run past the line', () => {
    expect('be or grow firm, strong'.length).toBeGreaterThan(LINE_MAX);
    expect(lineGloss(w('2388', 'HVNp3ms'), glosses)).toBe('be or grow firm');
    // A single long item stays whole rather than being cut mid-phrase.
    expect(lineGloss(w('853', 'HTo'), glosses)).toBe('mark of the accusative');
  });

  it('shows a name the way the build left it', () => {
    expect(lineGloss(w('7586', 'HNpm'), glosses)).toBe('šāʾûl');
  });

  it('glosses a word that is a prefix with a suffix', () => {
    expect(lineGloss(w('l', 'HR/Sp3ms', 'לוֹ'), glosses)).toBe('to, for');
  });

  it('has nothing for a lemma nothing glosses, or before the index loads', () => {
    expect(lineGloss(w('9999', 'HNcmsa'), glosses)).toBeUndefined();
    expect(lineGloss(w('1571', 'HD'), null)).toBeUndefined();
  });
});
