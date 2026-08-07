import { describe, expect, it } from 'vitest';
import {
  chapterDecks,
  chapterDecksByTextbook,
  deckId,
  findDeck,
  isInChapter,
  TEXTBOOK_IDS,
  TEXTBOOKS,
  wordsInChapter,
} from './textbooks';
import { vocabulary } from './vocabulary';

describe('TEXTBOOKS', () => {
  it('keys every entry by its own id', () => {
    for (const id of TEXTBOOK_IDS) {
      expect(TEXTBOOKS[id].id).toBe(id);
    }
  });

  it('gives every textbook a title, authors, short title, and unit label', () => {
    for (const id of TEXTBOOK_IDS) {
      const book = TEXTBOOKS[id];
      expect(book.title.trim().length).toBeGreaterThan(0);
      expect(book.authors.trim().length).toBeGreaterThan(0);
      expect(book.shortTitle.trim().length).toBeGreaterThan(0);
      expect(book.unitLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it('includes Garrett & DeRouchie', () => {
    expect(TEXTBOOKS['garrett-derouchie'].title).toBe('A Modern Grammar for Biblical Hebrew');
  });
});

describe('deckId', () => {
  it('joins textbook and chapter', () => {
    expect(deckId('garrett-derouchie', 3)).toBe('garrett-derouchie:3');
  });
});

describe('isInChapter', () => {
  const word = vocabulary.find((w) => w.hebrew === 'מֶלֶךְ')!;

  it('is true for a chapter the word is tagged with', () => {
    expect(isInChapter(word, 'garrett-derouchie', 1)).toBe(true);
  });

  it('is false for a chapter the word is not tagged with', () => {
    expect(isInChapter(word, 'garrett-derouchie', 2)).toBe(false);
  });

  it('is false for an untagged word', () => {
    const untagged = vocabulary.find((w) => w.chapters === undefined)!;
    expect(isInChapter(untagged, 'garrett-derouchie', 1)).toBe(false);
  });
});

describe('wordsInChapter', () => {
  it('returns exactly the words tagged for that chapter', () => {
    const words = wordsInChapter('garrett-derouchie', 1);
    expect(words.length).toBeGreaterThan(0);
    for (const word of words) {
      expect(isInChapter(word, 'garrett-derouchie', 1)).toBe(true);
    }
    const tagged = vocabulary.filter((w) => isInChapter(w, 'garrett-derouchie', 1));
    expect(words).toEqual(tagged);
  });

  it('returns an empty array for a chapter with no vocabulary yet', () => {
    expect(wordsInChapter('garrett-derouchie', 999)).toEqual([]);
  });
});

describe('chapterDecks', () => {
  const decks = chapterDecks();

  it('builds at least one deck', () => {
    expect(decks.length).toBeGreaterThan(0);
  });

  it('never builds an empty deck', () => {
    for (const deck of decks) {
      expect(deck.words.length).toBeGreaterThan(0);
    }
  });

  it('orders decks by ascending chapter number within a textbook', () => {
    for (const { decks: group } of chapterDecksByTextbook()) {
      const chapters = group.map((d) => d.chapter);
      expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    }
  });

  it('gives each deck a unique id matching deckId()', () => {
    const ids = decks.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const deck of decks) {
      expect(deck.id).toBe(deckId(deck.textbook, deck.chapter));
    }
  });

  it('labels decks with the textbook short title and chapter', () => {
    for (const deck of decks) {
      const book = TEXTBOOKS[deck.textbook];
      expect(deck.label).toBe(`${book.shortTitle} ${book.unitLabel} ${deck.chapter}`);
      expect(deck.shortLabel).toBe(`${book.unitLabel} ${deck.chapter}`);
    }
  });

  it('can be narrowed to a single textbook', () => {
    const narrowed = chapterDecks('garrett-derouchie');
    expect(narrowed.every((d) => d.textbook === 'garrett-derouchie')).toBe(true);
    expect(narrowed.length).toBeGreaterThan(0);
  });
});

describe('chapterDecksByTextbook', () => {
  it('groups every deck under its textbook exactly once', () => {
    const groups = chapterDecksByTextbook();
    const bookIds = groups.map((g) => g.textbook.id);
    expect(new Set(bookIds).size).toBe(bookIds.length);
    expect(groups.flatMap((g) => g.decks)).toEqual(chapterDecks());
  });

  it('omits textbooks with no tagged vocabulary', () => {
    for (const group of chapterDecksByTextbook()) {
      expect(group.decks.length).toBeGreaterThan(0);
    }
  });
});

describe('findDeck', () => {
  it('finds a deck by id', () => {
    const deck = findDeck('garrett-derouchie:1');
    expect(deck?.chapter).toBe(1);
  });

  it('returns undefined for an unknown id', () => {
    expect(findDeck('garrett-derouchie:999')).toBeUndefined();
    expect(findDeck('nope')).toBeUndefined();
  });
});

// ─── Garrett & DeRouchie chapter 1 ────────────────────────────────────────────

describe('Garrett & DeRouchie chapter 1', () => {
  const words = wordsInChapter('garrett-derouchie', 1);

  it('contains the full published list', () => {
    expect(words.map((w) => w.hebrew).sort()).toEqual(
      [
        'אָדָם',
        'אֶרֶץ',
        'אֵשׁ',
        'דָּבָר',
        'דַּעַת',
        'זָקֵן',
        'חָצֵר',
        'מֶלֶךְ',
        'עֶבֶד',
        'צֹאן',
        'שַׂר',
        'שֹׁפֵט',
      ].sort(),
    );
  });

  it('lists a gender for every entry', () => {
    for (const word of words) {
      expect(word.gender, `${word.hebrew} is missing a gender`).toBeDefined();
    }
  });

  it('marks חָצֵר as both masculine and feminine', () => {
    expect(words.find((w) => w.hebrew === 'חָצֵר')?.gender).toBe('fm');
  });
});
