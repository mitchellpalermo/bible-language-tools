import { describe, expect, it } from 'vitest';
import { allGlyphs, baseText, glyphsInGroup, renderableText, type ScriptPack } from './script-pack';

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

  it('prefers referenceForm over the bare identity', () => {
    // Some letters are never written bare — Hebrew's final kaf carries a
    // silent sheva wherever it occurs. The card stays keyed by the letter;
    // only what gets drawn changes.
    const kaf = { char: 'ך', referenceForm: 'ךְ', name: 'kaf sofit', group: 'final' as const };
    expect(renderableText({ ...pack, glyphs: [kaf] }, kaf)).toBe('ךְ');
    expect(kaf.char).toBe('ך');
  });

  it('ignores referenceForm on a combining mark, which needs its host', () => {
    const mark = { char: 'ָ', referenceForm: 'ignored', name: 'qamets', group: 'vowel' as const };
    expect(renderableText(pack, mark)).toBe('פָ');
  });
});

describe('baseText', () => {
  it('is the host consonant for a combining mark', () => {
    // Rasterize פָ and פ, and the difference is the qamets — which is how
    // placement gets scored without hand-authored outlines.
    expect(baseText(pack, pack.combining!.marks[0])).toBe('פ');
  });

  it('is null for a glyph that is written whole', () => {
    expect(baseText(pack, pack.glyphs[0])).toBeNull();
  });

  it('is null for a combining mark in a pack with no host', () => {
    const { combining: _combining, ...bare } = pack;
    expect(baseText(bare, pack.combining!.marks[0])).toBeNull();
  });

  it('prefers an explicit baseForm', () => {
    // שׁ is ש plus a dot, and the dot's side is the whole distinction — but it
    // is not a combining mark and has no host to fall back on.
    const shin = { char: 'שׁ', baseForm: 'ש', name: 'shin', group: 'consonant' as const };
    expect(baseText(pack, shin)).toBe('ש');
  });

  it('lets baseForm override the host for a combining mark', () => {
    const mark = { char: 'ָ', baseForm: 'ב', name: 'qamets', group: 'vowel' as const };
    expect(baseText(pack, mark)).toBe('ב');
  });
});

describe('glyphsInGroup', () => {
  it('filters by group across base and combining glyphs', () => {
    expect(glyphsInGroup(pack, 'consonant').map(g => g.char)).toEqual(['א']);
    expect(glyphsInGroup(pack, 'vowel').map(g => g.name)).toEqual(['qamets']);
    expect(glyphsInGroup(pack, 'other')).toEqual([]);
  });
});
