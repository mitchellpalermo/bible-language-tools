import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newCard, saveSRSStore, type SRSCard } from '../data/srs';
import type { HebrewVocabWord } from '../data/vocabulary';
import { vocabulary } from '../data/vocabulary';
import { lemmaBase, lemmaCardKeys, loadStudiedLemmas, studiedLemmas } from './studied';

const entry = (over: Partial<HebrewVocabWord> = {}): HebrewVocabWord => ({
  hebrew: 'דָּבָר',
  gloss: 'word',
  partOfSpeech: 'noun',
  strong: '1697',
  ...over,
});

/** A card the student has answered correctly at least once. */
const studiedCard = (key: string): SRSCard => ({ ...newCard(key), repetition: 3 });

const store = (...cards: SRSCard[]): Record<string, SRSCard> =>
  Object.fromEntries(cards.map((card) => [card.key, card]));

describe('lemmaBase', () => {
  it('drops the BDB sense-split letter', () => {
    expect(lemmaBase('1254a')).toBe('1254');
    expect(lemmaBase('5892b')).toBe('5892');
    expect(lemmaBase('2416e')).toBe('2416');
  });

  it('leaves a plain Strong’s number alone', () => {
    expect(lemmaBase('7225')).toBe('7225');
  });

  // The eight inseparable prefixes are letter codes with no number in them.
  // Collapsing them would put every one of them — a third of the corpus's
  // tokens — onto a single key.
  it('leaves a prefix’s letter code alone', () => {
    for (const code of ['b', 'c', 'd', 'i', 'k', 'l', 'm', 's']) {
      expect(lemmaBase(code)).toBe(code);
    }
  });
});

describe('lemmaCardKeys', () => {
  it('indexes a word by the lexeme its Strong’s number names', () => {
    expect(lemmaCardKeys([entry()]).get('1697')).toEqual(['דָּבָר']);
  });

  // Homographs are separated by sense, and `cardKey` is what carries that into
  // the SRS store. `normalizeKey(word.hebrew)` is the bug that convention
  // replaced, and it would put both of these on one card.
  it('keys a homograph by its sense, not by its bare spelling', () => {
    const index = lemmaCardKeys([
      entry({ hebrew: 'בָּרוּךְ', sense: 'blessed', strong: '1288' }),
      entry({ hebrew: 'בָּרוּךְ', sense: 'Baruch', strong: '1263' }),
    ]);
    expect(index.get('1288')).toEqual(['בָּרוּךְ#blessed']);
    expect(index.get('1263')).toEqual(['בָּרוּךְ#Baruch']);
  });

  // וַיֹּאמֶר and אָמַר are two cards over one lexeme — the reading form and the
  // citation form. Both are ways of having studied the word.
  it('collects every card a lexeme has', () => {
    const index = lemmaCardKeys([
      entry({ hebrew: 'אָמַר', strong: '559' }),
      entry({ hebrew: 'וַיֹּאמֶר', strong: '559' }),
    ]);
    expect(index.get('559')).toEqual(['אָמַר', 'וַיֹּאמֶר']);
  });

  it('skips an entry OSHB could not resolve, which has no lemma to be found by', () => {
    expect(lemmaCardKeys([entry({ strong: undefined })]).size).toBe(0);
  });
});

describe('studiedLemmas', () => {
  const words = [entry()];

  it('counts a word the student has answered correctly', () => {
    expect(studiedLemmas(store(studiedCard('דָּבָר')), words).has('1697')).toBe(true);
  });

  // A card dealt and failed is not a word you know — the same bar greek.tools
  // sets.
  it('does not count a card that has never been answered correctly', () => {
    expect(studiedLemmas(store(newCard('דָּבָר')), words).has('1697')).toBe(false);
  });

  it('does not count a word with no card at all', () => {
    expect(studiedLemmas({}, words).size).toBe(0);
  });

  // 5892a and 5892b are both עִיר. Which split the corpus coded a given
  // occurrence as is not something a student should see the highlight change on.
  it('matches across a lexeme’s BDB sense splits', () => {
    const studied = studiedLemmas(store(studiedCard('עִיר')), [
      entry({ hebrew: 'עִיר', strong: '5892b' }),
    ]);
    expect(studied.has(lemmaBase('5892a'))).toBe(true);
  });

  // 5893 is a different word spelled the same way, and it keeps its own answer.
  it('does not match across homographs', () => {
    const studied = studiedLemmas(store(studiedCard('עִיר')), [
      entry({ hebrew: 'עִיר', strong: '5892b' }),
    ]);
    expect(studied.has(lemmaBase('5893'))).toBe(false);
  });

  it('counts a lexeme studied under any one of its cards', () => {
    const both = [entry({ hebrew: 'אָמַר', strong: '559' }), entry({ hebrew: 'וַיֹּאמֶר', strong: '559' })];
    expect(studiedLemmas(store(studiedCard('וַיֹּאמֶר')), both).has('559')).toBe(true);
  });

  // The real vocabulary, as the reader will actually use it.
  it('joins the shipped vocabulary to the store', () => {
    const word = vocabulary.find((w) => w.strong && !w.sense);
    if (!word?.strong) throw new Error('the vocabulary has no resolvable entry to test with');
    const studied = studiedLemmas(store(studiedCard(word.hebrew)));
    expect(studied.has(lemmaBase(word.strong))).toBe(true);
  });
});

describe('loadStudiedLemmas', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads the store the flashcards wrote', () => {
    const word = vocabulary.find((w) => w.strong && !w.sense);
    if (!word?.strong) throw new Error('the vocabulary has no resolvable entry to test with');
    saveSRSStore(store(studiedCard(word.hebrew)));
    expect(loadStudiedLemmas().has(lemmaBase(word.strong))).toBe(true);
  });

  it('is empty when nothing has been studied', () => {
    expect(loadStudiedLemmas().size).toBe(0);
  });

  // Highlighting is an aid. Losing it is not a reason to fail the reader.
  it('gives back an empty set rather than throwing when the store is unreadable', () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadStudiedLemmas().size).toBe(0);
    getItem.mockRestore();
  });
});
