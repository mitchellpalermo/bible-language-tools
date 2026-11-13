import { describe, expect, it } from 'vitest';
import { checkGlossAnswer, levenshtein } from './gloss-answer';

describe('levenshtein', () => {
  it('is zero for equal strings', () => {
    expect(levenshtein('word', 'word')).toBe(0);
  });

  it('counts a substitution, an insertion and a deletion as one edit each', () => {
    expect(levenshtein('word', 'ward')).toBe(1);
    expect(levenshtein('word', 'words')).toBe(1);
    expect(levenshtein('word', 'wrd')).toBe(1);
  });

  it('is the length of the other string against an empty one', () => {
    expect(levenshtein('', 'king')).toBe(4);
    expect(levenshtein('king', '')).toBe(4);
  });
});

describe('checkGlossAnswer', () => {
  it('accepts any one sense of a gloss', () => {
    expect(checkGlossAnswer('word', 'word, thing')).toBe(true);
    expect(checkGlossAnswer('thing', 'word, thing')).toBe(true);
    expect(checkGlossAnswer('or', 'and/or')).toBe(true);
  });

  it('ignores case, surrounding space and parentheses', () => {
    expect(checkGlossAnswer('  WORD ', 'word, thing')).toBe(true);
    expect(checkGlossAnswer('the definite article', 'the (definite article)')).toBe(true);
  });

  it('never accepts an empty answer', () => {
    expect(checkGlossAnswer('', 'word')).toBe(false);
    expect(checkGlossAnswer('   ', 'word')).toBe(false);
  });

  it('accepts the start of a sense once four letters are typed', () => {
    expect(checkGlossAnswer('righ', 'righteousness')).toBe(true);
    expect(checkGlossAnswer('rig', 'righteousness')).toBe(false);
  });

  it('forgives one slip in a sense longer than three letters', () => {
    expect(checkGlossAnswer('kingdon', 'kingdom')).toBe(true);
    expect(checkGlossAnswer('kinkdon', 'kingdom')).toBe(false);
    // Three letters is too short to tell a slip from another word.
    expect(checkGlossAnswer('sun', 'son')).toBe(false);
  });

  it('rejects a different word', () => {
    expect(checkGlossAnswer('queen', 'king')).toBe(false);
  });

  it('splits on a comma or a slash unless told otherwise', () => {
    expect(checkGlossAnswer('self', 'he, she, it; self, same')).toBe(false);
    expect(checkGlossAnswer('self', 'he, she, it; self, same', { separators: /[,/;]/ })).toBe(true);
  });

  it('accepts the variants an app offers for a sense, and still the sense itself', () => {
    const variants = (sense: string) => [sense.replace(/^\s*he /, '')];
    expect(checkGlossAnswer('wrote', 'he wrote', { variants })).toBe(true);
    expect(checkGlossAnswer('he wrote', 'he wrote', { variants })).toBe(true);
    expect(checkGlossAnswer('wrote', 'he wrote')).toBe(false);
  });

  it('ignores a variant that comes out empty', () => {
    expect(checkGlossAnswer('x', 'he', { variants: () => [''] })).toBe(false);
  });
});
