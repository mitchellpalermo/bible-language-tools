import type { WritableGlyph } from '@tools/shared/ink';
import { describe, expect, it } from 'vitest';
import { hebrewScriptPack } from './script-pack';
import { newCard, type SRSCard } from './srs';
import {
  buildDecks,
  buildQueue,
  countNew,
  isPassingGrade,
  isWritingKey,
  practiceableGlyphs,
  qualityFor,
  WRITING_GRADES,
  WRITING_KEY_PREFIX,
  writingCardKey,
  writingCards,
} from './writing';

function glyph(char: string, name = char): WritableGlyph {
  return { char, name, group: 'consonant' };
}

/** A card in the store, due today unless pushed out. */
function cardFor(char: string, overrides: Partial<SRSCard> = {}): SRSCard {
  return { ...newCard(writingCardKey(char)), ...overrides };
}

describe('card keys', () => {
  it('prefixes every writing card', () => {
    expect(writingCardKey('א')).toBe('write:letter:א');
    expect(isWritingKey(writingCardKey('א'))).toBe(true);
  });

  it('does not claim a bare vocabulary lemma', () => {
    // Vocabulary cards are keyed by lemma. A single-letter entry must not be
    // mistaken for a handwriting card, or the two features share progress.
    expect(isWritingKey('א')).toBe(false);
    expect(isWritingKey('וְ')).toBe(false);
  });

  it('keeps the prefix and the helper in agreement', () => {
    expect(writingCardKey('ב').startsWith(WRITING_KEY_PREFIX)).toBe(true);
  });
});

describe('buildDecks', () => {
  it('offers the alphabet, the finals, and both together', () => {
    const decks = buildDecks();
    expect(decks.map(d => d.id)).toEqual(['alphabet', 'finals', 'all-consonants']);
  });

  it('has 22 consonants and 5 final forms', () => {
    const [alphabet, finals, all] = buildDecks();
    expect(alphabet.glyphs).toHaveLength(22);
    expect(finals.glyphs).toHaveLength(5);
    expect(all.glyphs).toHaveLength(27);
  });

  it('excludes vowel points, which are their own deck', () => {
    const chars = buildDecks().flatMap(d => d.glyphs.map(g => g.group));
    expect(chars).not.toContain('vowel');
  });

  it('starts the alphabet at alef and ends at tav', () => {
    const [alphabet] = buildDecks();
    expect(alphabet.glyphs[0].char).toBe('א');
    expect(alphabet.glyphs[21].char).toBe('ת');
  });
});

describe('buildQueue', () => {
  const glyphs = [glyph('א'), glyph('ב'), glyph('ג'), glyph('ד')];

  it('keeps alphabetical order for unseen letters', () => {
    // Deliberately unlike the vocabulary flashcards, which shuffle. Learning
    // the alphabet includes learning its order.
    expect(buildQueue(glyphs, {}).map(g => g.char)).toEqual(['א', 'ב', 'ג', 'ד']);
  });

  it('puts due cards before new ones, each in pack order', () => {
    const store = {
      [writingCardKey('ג')]: cardFor('ג'),
      [writingCardKey('ד')]: cardFor('ד'),
    };
    expect(buildQueue(glyphs, store).map(g => g.char)).toEqual(['ג', 'ד', 'א', 'ב']);
  });

  it('omits cards that are not yet due', () => {
    const store = {
      [writingCardKey('א')]: cardFor('א', { dueDate: '2999-01-01' }),
      [writingCardKey('ב')]: cardFor('ב'),
    };
    expect(buildQueue(glyphs, store).map(g => g.char)).toEqual(['ב', 'ג', 'ד']);
  });

  it('returns everything in order in "all" mode, due or not', () => {
    const store = { [writingCardKey('א')]: cardFor('א', { dueDate: '2999-01-01' }) };
    expect(buildQueue(glyphs, store, 'all').map(g => g.char)).toEqual(['א', 'ב', 'ג', 'ד']);
  });

  it('can come back empty when nothing is due', () => {
    const store = Object.fromEntries(
      glyphs.map(g => [writingCardKey(g.char), cardFor(g.char, { dueDate: '2999-01-01' })]),
    );
    expect(buildQueue(glyphs, store)).toEqual([]);
  });
});

describe('grading', () => {
  it('maps each button to an SM-2 quality', () => {
    expect(qualityFor('again')).toBe(1);
    expect(qualityFor('hard')).toBe(3);
    expect(qualityFor('good')).toBe(4);
    expect(qualityFor('easy')).toBe(5);
  });

  it('treats anything below quality 3 as a lapse, matching SM-2', () => {
    // nextSRS resets repetition below 3, so the pass threshold has to agree
    // with it or the streak and the scheduler disagree about the same review.
    expect(isPassingGrade('again')).toBe(false);
    expect(isPassingGrade('hard')).toBe(true);
    expect(isPassingGrade('good')).toBe(true);
    expect(isPassingGrade('easy')).toBe(true);
  });

  it('exposes exactly four grades', () => {
    expect(WRITING_GRADES).toHaveLength(4);
  });
});

describe('progress helpers', () => {
  it('counts letters never written', () => {
    const glyphs = [glyph('א'), glyph('ב'), glyph('ג')];
    expect(countNew(glyphs, {})).toBe(3);
    expect(countNew(glyphs, { [writingCardKey('ב')]: cardFor('ב') })).toBe(2);
  });

  it('picks writing cards out of a store shared with vocabulary', () => {
    const store: Record<string, SRSCard> = {
      [writingCardKey('א')]: cardFor('א'),
      אֶרֶץ: newCard('אֶרֶץ'),
      [writingCardKey('ב')]: cardFor('ב'),
    };
    expect(writingCards(store)).toHaveLength(2);
  });
});

describe('practiceableGlyphs', () => {
  it('includes the vowel points the decks do not yet cover', () => {
    const groups = new Set(practiceableGlyphs(hebrewScriptPack).map(g => g.group));
    expect(groups.has('vowel')).toBe(true);
  });
});
