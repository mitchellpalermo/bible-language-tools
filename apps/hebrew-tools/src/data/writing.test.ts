import { renderableText, VERDICT_THRESHOLDS, type WritableGlyph } from '@tools/shared/ink';
import { describe, expect, it } from 'vitest';
import { hebrewScriptPack } from './script-pack';
import { newCard, type SRSCard } from './srs';
import {
  buildDecks,
  buildQueue,
  CONFUSABLE_ROUNDS,
  confusableGroups,
  countNew,
  interleave,
  isPassingGrade,
  isWritingKey,
  practiceableGlyphs,
  qualityFor,
  shouldUpdateCard,
  suggestedGrade,
  WRITING_DECK_CATEGORIES,
  WRITING_GRADES,
  WRITING_KEY_PREFIXES,
  type WritingDeck,
  type WritingQueueOrder,
  writingCardKey,
  writingCards,
} from './writing';

function glyph(char: string, name = char): WritableGlyph {
  return { char, name, group: 'consonant' };
}

const keyOf = (char: string) => writingCardKey(glyph(char));

/** A card in the store, due today unless pushed out. */
function cardFor(char: string, overrides: Partial<SRSCard> = {}): SRSCard {
  return { ...newCard(keyOf(char)), ...overrides };
}

/** The subset of a deck `buildQueue` reads. */
function deck(glyphs: WritableGlyph[], order: WritingQueueOrder = 'due-first'): WritingDeck {
  return { id: 'test', label: 'Test', category: 'letters', glyphs, order };
}

const deckById = (id: string) => buildDecks().find(d => d.id === id) as WritingDeck;

describe('card keys', () => {
  it('prefixes every writing card', () => {
    expect(keyOf('א')).toBe('write:letter:א');
    expect(isWritingKey(keyOf('א'))).toBe(true);
  });

  it('keys vowel points under their own prefix', () => {
    // Letters and points are separate skills on separate schedules, and the
    // namespaces would otherwise collide: shureq is written וּ, which is also a
    // vav with a dagesh.
    const qamets = deckById('nikud').glyphs.find(g => g.name === 'qamets') as WritableGlyph;
    expect(writingCardKey(qamets)).toBe('write:nikud:ָ');
    expect(isWritingKey(writingCardKey(qamets))).toBe(true);
  });

  it('gives every deck a key under one of the declared prefixes', () => {
    for (const d of buildDecks()) {
      for (const g of d.glyphs) {
        expect(WRITING_KEY_PREFIXES.some(p => writingCardKey(g).startsWith(p))).toBe(true);
      }
    }
  });

  it('never lets a letter and a point share a card', () => {
    const letters = new Set(deckById('all-consonants').glyphs.map(writingCardKey));
    for (const g of deckById('nikud').glyphs) {
      expect(letters.has(writingCardKey(g))).toBe(false);
    }
  });

  it('does not claim a bare vocabulary lemma', () => {
    // Vocabulary cards are keyed by lemma. A single-letter entry must not be
    // mistaken for a handwriting card, or the two features share progress.
    expect(isWritingKey('א')).toBe(false);
    expect(isWritingKey('וְ')).toBe(false);
  });
});

describe('buildDecks', () => {
  it('offers letters, vowel points, and the confusable pairs', () => {
    const decks = buildDecks();
    expect(decks.slice(0, 5).map(d => d.id)).toEqual([
      'alphabet',
      'finals',
      'all-consonants',
      'nikud',
      'confusable-all',
    ]);
  });

  it('files every deck under a category the picker renders', () => {
    const known = new Set(WRITING_DECK_CATEGORIES.map(c => c.id));
    for (const d of buildDecks()) expect(known.has(d.category)).toBe(true);
  });

  it('has 23 consonant cards for the 22 letters, plus 5 final forms', () => {
    // 23, not 22: shin and sin share a letter but are drilled separately,
    // because putting the dot on the correct side is the skill.
    const [alphabet, finals, all] = buildDecks();
    expect(alphabet.glyphs).toHaveLength(23);
    expect(finals.glyphs).toHaveLength(5);
    expect(all.glyphs).toHaveLength(28);
  });

  it('drills shin and sin as separate, pointed cards', () => {
    const chars = deckById('alphabet').glyphs.map(g => g.char);
    expect(chars).toContain('שׁ');
    expect(chars).toContain('שׂ');
    // A bare shin is neither letter and appears nowhere in the Hebrew Bible.
    expect(chars).not.toContain('ש');
  });

  it('keeps vowel points out of the letter decks', () => {
    for (const id of ['alphabet', 'finals', 'all-consonants']) {
      expect(deckById(id).glyphs.some(g => g.group === 'vowel')).toBe(false);
    }
  });

  it('starts the alphabet at alef and ends at tav', () => {
    const alphabet = deckById('alphabet');
    expect(alphabet.glyphs[0].char).toBe('א');
    expect(alphabet.glyphs[22].char).toBe('ת');
  });
});

describe('the vowel deck', () => {
  const nikud = deckById('nikud');

  it('covers the nine full vowels, three hatephs and the sheva', () => {
    expect(nikud.glyphs).toHaveLength(13);
    expect(nikud.glyphs.filter(g => g.name.startsWith('hateph'))).toHaveLength(3);
    expect(nikud.glyphs.map(g => g.name)).toContain('sheva');
  });

  it('composes every point onto the host consonant', () => {
    // A vowel point rendered alone is a stray tick attached to nothing.
    for (const g of nikud.glyphs) {
      expect(renderableText(hebrewScriptPack, g)).toBe(`פ${g.char}`);
    }
  });

  it('writes the two vowel letters as vav plus their mark, in that order', () => {
    // Holem male encoded the WLC's way round — point before vav — lands the
    // point on the preceding consonant instead of on the vav.
    const byName = (n: string) => nikud.glyphs.find(g => g.name === n) as WritableGlyph;
    expect(byName('shureq').char).toBe('וּ');
    expect(byName('holem male').char).toBe('וֹ');
  });

  it('omits qamets qatan, which is written identically to qamets', () => {
    // U+05C7 exists, but the WLC writes the vowel with an ordinary qamets and
    // the two are drawn the same. A card whose reference is pixel-for-pixel
    // another card's teaches nothing about handwriting.
    expect(nikud.glyphs.map(g => g.char)).not.toContain('ׇ');
  });

  it('tells the student where the point goes, not merely what it looks like', () => {
    // Placement is the skill, so every card carries a placement note.
    for (const g of nikud.glyphs) expect(g.note).toBeTruthy();
  });
});

describe('confusableGroups', () => {
  const groups = confusableGroups();

  it('closes over the relation rather than emitting one group per glyph', () => {
    // ה names ח and ת; ח names ה and ת. That is one group of three.
    const three = groups.find(g => g.some(m => m.char === 'ה')) as WritableGlyph[];
    expect(three.map(m => m.char)).toEqual(['ה', 'ח', 'ת']);
  });

  it('finds the pairs a first-year student actually loses marks on', () => {
    expect(groups.map(g => g.map(m => m.char).join(''))).toEqual([
      'בכ',
      'דר',
      'החת',
      'וזן',
      'סם',
      'עצ',
      'שׁשׂ',
    ]);
  });

  it('groups across the consonant and final decks', () => {
    // ו/ן and ס/ם straddle the two groups, which is exactly why they confuse.
    const finals = groups.find(g => g.some(m => m.char === 'ן')) as WritableGlyph[];
    expect(finals.map(m => m.group)).toEqual(['consonant', 'consonant', 'final']);
  });

  it('reads the relation as undirected', () => {
    // A glyph naming a partner joins that partner's group whether or not the
    // partner names it back, so a one-sided edge cannot split a pair in two.
    const pack = {
      ...hebrewScriptPack,
      glyphs: [
        { char: 'a', name: 'a', group: 'consonant' as const, confusableWith: ['b'] },
        { char: 'b', name: 'b', group: 'consonant' as const },
      ],
      combining: undefined,
    };
    expect(confusableGroups(pack).map(g => g.map(m => m.char))).toEqual([['a', 'b']]);
  });

  it('ignores partners the pack does not contain', () => {
    const pack = {
      ...hebrewScriptPack,
      glyphs: [{ char: 'a', name: 'a', group: 'consonant' as const, confusableWith: ['zz'] }],
      combining: undefined,
    };
    expect(confusableGroups(pack)).toEqual([]);
  });
});

describe('interleave', () => {
  const [a, b, c] = [glyph('a'), glyph('b'), glyph('c')];
  const [x, y] = [glyph('x'), glyph('y')];

  it('deals one member from each group in turn', () => {
    expect(interleave([[a, b], [x, y]]).map(g => g.char)).toEqual(['a', 'x', 'b', 'y']);
  });

  it('alternates a single group across its rounds', () => {
    // The contrast the confusable decks are for: ד ר ד ר, never ד ד ד ר ר ר.
    expect(interleave([[a, b]], 3).map(g => g.char)).toEqual(['a', 'b', 'a', 'b', 'a', 'b']);
  });

  it('handles groups of unequal length without dropping the longer', () => {
    expect(interleave([[a, b, c], [x]]).map(g => g.char)).toEqual(['a', 'x', 'b', 'c']);
  });

  it('is empty for no groups', () => {
    expect(interleave([])).toEqual([]);
  });
});

describe('the confusable decks', () => {
  it('gives each group its own deck, named rather than shown', () => {
    // A picker chip reading "ד / ר" asks the student to tell apart the two
    // letters the deck exists because they cannot yet tell apart.
    const dalet = deckById('confusable-דר');
    expect(dalet.label).toBe('dalet / resh');
    expect(dalet.category).toBe('confusables');
  });

  it('repeats each member so there is something to alternate between', () => {
    const chars = deckById('confusable-דר').glyphs.map(g => g.char);
    expect(chars).toEqual(['ד', 'ר', 'ד', 'ר', 'ד', 'ר']);
    expect(chars).toHaveLength(2 * CONFUSABLE_ROUNDS);
  });

  it('never presents the same glyph twice in a row', () => {
    for (const d of buildDecks().filter(d => d.category === 'confusables')) {
      for (let i = 1; i < d.glyphs.length; i++) {
        expect(d.glyphs[i].char).not.toBe(d.glyphs[i - 1].char);
      }
    }
  });

  it('spreads the combined deck across the groups, one pass each', () => {
    const chars = deckById('confusable-all').glyphs.map(g => g.char);
    expect(chars.slice(0, 7)).toEqual(['ב', 'ד', 'ה', 'ו', 'ס', 'ע', 'שׁ']);
    expect(chars).toHaveLength(16);
    expect(new Set(chars).size).toBe(16);
  });

  it('reviews the same cards the alphabet deck does', () => {
    // A confusable deck is another angle on the same letters, not a parallel
    // set of progress. Grading ד here must move the ד the alphabet deck sees.
    const letters = new Set(deckById('all-consonants').glyphs.map(writingCardKey));
    for (const g of deckById('confusable-all').glyphs) {
      expect(letters.has(writingCardKey(g))).toBe(true);
    }
  });
});

describe('buildQueue', () => {
  const glyphs = [glyph('א'), glyph('ב'), glyph('ג'), glyph('ד')];

  it('keeps alphabetical order for unseen letters', () => {
    // Deliberately unlike the vocabulary flashcards, which shuffle. Learning
    // the alphabet includes learning its order.
    expect(buildQueue(deck(glyphs), {}).map(g => g.char)).toEqual(['א', 'ב', 'ג', 'ד']);
  });

  it('puts due cards before new ones, each in pack order', () => {
    const store = { [keyOf('ג')]: cardFor('ג'), [keyOf('ד')]: cardFor('ד') };
    expect(buildQueue(deck(glyphs), store).map(g => g.char)).toEqual(['ג', 'ד', 'א', 'ב']);
  });

  it('omits cards that are not yet due', () => {
    const store = {
      [keyOf('א')]: cardFor('א', { dueDate: '2999-01-01' }),
      [keyOf('ב')]: cardFor('ב'),
    };
    expect(buildQueue(deck(glyphs), store).map(g => g.char)).toEqual(['ב', 'ג', 'ד']);
  });

  it('returns everything in order in "all" mode, due or not', () => {
    const store = { [keyOf('א')]: cardFor('א', { dueDate: '2999-01-01' }) };
    expect(buildQueue(deck(glyphs), store, 'all').map(g => g.char)).toEqual([
      'א',
      'ב',
      'ג',
      'ד',
    ]);
  });

  it('can come back empty when nothing is due', () => {
    const store = Object.fromEntries(
      glyphs.map(g => [keyOf(g.char), cardFor(g.char, { dueDate: '2999-01-01' })]),
    );
    expect(buildQueue(deck(glyphs), store)).toEqual([]);
  });

  it('leaves an as-built deck interleaved even when only some cards are due', () => {
    // The regression `order` exists to prevent. Hoisting due cards to the
    // front of a confusable deck reassembles the blocked presentation — ד ד ד
    // then ר ר ר — that the deck was constructed to avoid.
    const pair = [glyph('ד'), glyph('ר'), glyph('ד'), glyph('ר')];
    const store = { [keyOf('ד')]: cardFor('ד') };

    expect(buildQueue(deck(pair, 'as-built'), store).map(g => g.char)).toEqual([
      'ד',
      'ר',
      'ד',
      'ר',
    ]);
    expect(buildQueue(deck(pair), store).map(g => g.char)).toEqual(['ד', 'ד', 'ר', 'ר']);
  });

  it('drops every repeat of a card that is not due', () => {
    const pair = [glyph('ד'), glyph('ר'), glyph('ד'), glyph('ר')];
    const store = { [keyOf('ד')]: cardFor('ד', { dueDate: '2999-01-01' }) };

    expect(buildQueue(deck(pair, 'as-built'), store).map(g => g.char)).toEqual(['ר', 'ר']);
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

  it('suggests a grade across the whole score range', () => {
    expect(suggestedGrade(100)).toBe('easy');
    expect(suggestedGrade(92)).toBe('easy');
    expect(suggestedGrade(91)).toBe('good');
    expect(suggestedGrade(VERDICT_THRESHOLDS.pass)).toBe('good');
    expect(suggestedGrade(VERDICT_THRESHOLDS.pass - 1)).toBe('hard');
    expect(suggestedGrade(VERDICT_THRESHOLDS.close)).toBe('hard');
    expect(suggestedGrade(VERDICT_THRESHOLDS.close - 1)).toBe('again');
    expect(suggestedGrade(0)).toBe('again');
  });

  it('never suggests a lapse for a passing score', () => {
    // The scorer's pass threshold and SM-2's are separate numbers that have to
    // agree, or a letter the app called a good match still resets its interval.
    for (let score = VERDICT_THRESHOLDS.pass; score <= 100; score++) {
      expect(isPassingGrade(suggestedGrade(score))).toBe(true);
    }
  });
});

describe('shouldUpdateCard', () => {
  it('always records the first review of a glyph in a session', () => {
    for (const g of WRITING_GRADES) expect(shouldUpdateCard(false, g.id)).toBe(true);
  });

  it('ignores a repeat pass, which SM-2 would read as spaced', () => {
    // A confusable deck shows ד three times in five minutes. Three passing
    // grades would stretch the interval as though they were three days apart.
    expect(shouldUpdateCard(true, 'good')).toBe(false);
    expect(shouldUpdateCard(true, 'easy')).toBe(false);
    expect(shouldUpdateCard(true, 'hard')).toBe(false);
  });

  it('still records a repeat lapse', () => {
    // Getting it wrong on the second look is real information; getting it
    // right again immediately is not.
    expect(shouldUpdateCard(true, 'again')).toBe(true);
  });
});

describe('progress helpers', () => {
  it('counts letters never written', () => {
    const glyphs = [glyph('א'), glyph('ב'), glyph('ג')];
    expect(countNew(glyphs, {})).toBe(3);
    expect(countNew(glyphs, { [keyOf('ב')]: cardFor('ב') })).toBe(2);
  });

  it('counts a repeated glyph once', () => {
    // A ד/ר deck is six presentations of two letters, not six new letters.
    expect(countNew(deckById('confusable-דר').glyphs, {})).toBe(2);
  });

  it('picks writing cards out of a store shared with vocabulary', () => {
    const store: Record<string, SRSCard> = {
      [keyOf('א')]: cardFor('א'),
      אֶרֶץ: newCard('אֶרֶץ'),
      [keyOf('ב')]: cardFor('ב'),
    };
    expect(writingCards(store)).toHaveLength(2);
  });

  it('picks up vowel cards too', () => {
    const qamets = deckById('nikud').glyphs[1];
    const store = { [writingCardKey(qamets)]: newCard(writingCardKey(qamets)) };
    expect(writingCards(store)).toHaveLength(1);
  });
});

describe('pointed reference forms', () => {
  const finals = deckById('finals').glyphs;
  const byName = (n: string) => finals.find(g => g.name === n) as WritableGlyph;

  it('traces final kaf with its silent sheva, keyed by the bare letter', () => {
    // Final kaf closes a syllable, so it carries a sheva essentially wherever
    // it occurs (מֶלֶךְ, הָלַךְ, מָלַךְ). Tracing a bare ך teaches a form that is
    // not written. The card's identity stays the letter itself.
    const kaf = byName('kaf sofit');
    expect(kaf.char).toBe('ך');
    expect(writingCardKey(kaf)).toBe('write:letter:ך');
    expect(renderableText(hebrewScriptPack, kaf)).toBe('ךְ');
  });

  it('leaves the other finals bare, which is how they occur', () => {
    for (const name of ['mem sofit', 'nun sofit', 'pe sofit', 'tsade sofit']) {
      const g = byName(name);
      expect(renderableText(hebrewScriptPack, g)).toBe(g.char);
    }
  });

  it('renders shin and sin with their dots already on', () => {
    const alphabet = deckById('alphabet');
    const shin = alphabet.glyphs.find(g => g.name === 'shin') as WritableGlyph;
    const sin = alphabet.glyphs.find(g => g.name === 'sin') as WritableGlyph;
    expect(renderableText(hebrewScriptPack, shin)).toBe('שׁ');
    expect(renderableText(hebrewScriptPack, sin)).toBe('שׂ');
    expect(shin.confusableWith).toContain(sin.char);
  });

  it('grades the shin dot as a mark on a bare ש', () => {
    // Under 1% of the letter's cells, so an area metric over the whole glyph
    // scores the dot on the wrong arm as very nearly correct. `baseForm` is
    // what lets scoring isolate it — see rasterizeComposite.
    const alphabet = deckById('alphabet');
    for (const name of ['shin', 'sin']) {
      expect(alphabet.glyphs.find(g => g.name === name)?.baseForm).toBe('ש');
    }
  });

  it('never presents a consonant or final as a bare form it lacks', () => {
    // The regression guard: every drilled glyph must render as something a
    // student would actually write.
    for (const g of deckById('all-consonants').glyphs) {
      expect(renderableText(hebrewScriptPack, g).length).toBeGreaterThan(0);
      if (g.referenceForm) expect(g.referenceForm).not.toBe(g.char);
    }
  });
});

describe('practiceableGlyphs', () => {
  it('includes the vowel points alongside the letters', () => {
    const groups = new Set(practiceableGlyphs(hebrewScriptPack).map(g => g.group));
    expect(groups.has('vowel')).toBe(true);
    expect(groups.has('consonant')).toBe(true);
  });
});
