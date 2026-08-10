import { describe, expect, it } from 'vitest';
import { allGlyphs, glyphsInGroup, renderableText, type ScriptPack } from './script-pack';

const pack: ScriptPack = {
  id: 'test',
  label: 'Test',
  direction: 'rtl',
  fontFamily: 'Noto Sans Hebrew, sans-serif',
  fontLoadSpec: '400 64px "Noto Sans Hebrew"',
  glyphs: [
    { char: 'א', name: 'alef', group: 'consonant' },
    { char: 'ך', name: 'kaf sofit', group: 'final' },
  ],
  combining: {
    hostChar: 'פ',
    marks: [{ char: 'ָ', name: 'qamets', group: 'vowel' }],
  },
  metrics: { emBox: 1000, baseline: 0, ascender: 750, descender: 250 },
};

describe('allGlyphs', () => {
  it('includes combining marks alongside the base glyphs', () => {
    expect(allGlyphs(pack).map(g => g.name)).toEqual(['alef', 'kaf sofit', 'qamets']);
  });

  it('works on a pack with no combining marks', () => {
    const { combining: _combining, ...bare } = pack;
    expect(allGlyphs(bare)).toHaveLength(2);
  });
});

describe('renderableText', () => {
  it('returns a consonant as-is', () => {
    expect(renderableText(pack, pack.glyphs[0])).toBe('א');
  });

  it('composes a vowel point onto its host consonant', () => {
    // A nikud rendered alone has nothing to attach to and draws as a stray
    // mark, so the pack supplies the host the student writes it under.
    expect(renderableText(pack, pack.combining!.marks[0])).toBe('פָ');
  });
});

describe('glyphsInGroup', () => {
  it('filters by group across base and combining glyphs', () => {
    expect(glyphsInGroup(pack, 'consonant').map(g => g.char)).toEqual(['א']);
    expect(glyphsInGroup(pack, 'vowel').map(g => g.name)).toEqual(['qamets']);
    expect(glyphsInGroup(pack, 'other')).toEqual([]);
  });
});
