import { renderableText, VERDICT_THRESHOLDS, type WritableGlyph } from '@tools/shared/ink';
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
  suggestedGrade,
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

  it('has 23 consonant cards for the 22 letters, plus 5 final forms', () => {
    // 23, not 22: shin and sin share a letter but are drilled separately,
    // because putting the dot on the correct side is the skill.
    const [alphabet, finals, all] = buildDecks();
    expect(alphabet.glyphs).toHaveLength(23);
    expect(finals.glyphs).toHaveLength(5);
    expect(all.glyphs).toHaveLength(28);
  });

  it('drills shin and sin as separate, pointed cards', () => {
    const [alphabet] = buildDecks();
    const chars = alphabet.glyphs.map(g => g.char);
    expect(chars).toContain('\u05E9\u05C1');
    expect(chars).toContain('\u05E9\u05C2');
    // A bare shin is neither letter and appears nowhere in the Hebrew Bible.
    expect(chars).not.toContain('\u05E9');
  });

  it('excludes vowel points, which are their own deck', () => {
    const chars = buildDecks().flatMap(d => d.glyphs.map(g => g.group));
    expect(chars).not.toContain('vowel');
  });

  it('starts the alphabet at alef and ends at tav', () => {
    const [alphabet] = buildDecks();
    expect(alphabet.glyphs[0].char).toBe('א');
    expect(alphabet.glyphs[22].char).toBe('ת');
  });
});

describe('pointed reference forms', () => {
  const finals = buildDecks()[1].glyphs;
  const byName = (n: string) => finals.find(g => g.name === n)!;

  it('traces final kaf with its silent sheva, keyed by the bare letter', () => {
    // Final kaf closes a syllable, so it carries a sheva essentially wherever
    // it occurs (מֶלֶךְ, הָלַךְ, מָלַךְ). Tracing a bare ך teaches a form that is
    // not written. The card's identity stays the letter itself.
    const kaf = byName('kaf sofit');
    expect(kaf.char).toBe('ך');
    expect(writingCardKey(kaf.char)).toBe('write:letter:ך');
    expect(renderableText(hebrewScriptPack, kaf)).toBe('ךְ');
  });

  it('leaves the other finals bare, which is how they occur', () => {
    for (const name of ['mem sofit', 'nun sofit', 'pe sofit', 'tsade sofit']) {
      const g = byName(name);
      expect(renderableText(hebrewScriptPack, g)).toBe(g.char);
    }
  });

  it('renders shin and sin with their dots already on', () => {
    const [alphabet] = buildDecks();
    const shin = alphabet.glyphs.find(g => g.name === 'shin')!;
    const sin = alphabet.glyphs.find(g => g.name === 'sin')!;
    expect(renderableText(hebrewScriptPack, shin)).toBe('שׁ');
    expect(renderableText(hebrewScriptPack, sin)).toBe('שׂ');
    expect(shin.confusableWith).toContain(sin.char);
  });

  it('never presents a consonant or final as a bare form it lacks', () => {
    // The regression guard: every drilled glyph must render as something a
    // student would actually write.
    const drilled = buildDecks()[2].glyphs;
    for (const g of drilled) {
      expect(renderableText(hebrewScriptPack, g).length).toBeGreaterThan(0);
      if (g.referenceForm) expect(g.referenceForm).not.toBe(g.char);
    }
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
