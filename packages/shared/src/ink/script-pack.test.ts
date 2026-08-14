import { describe, expect, it } from 'vitest';
import {
  allGlyphs,
  baseText,
  glyphsInGroup,
  renderableText,
  type ScriptPack,
  splitClusters,
} from './script-pack';

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

describe('splitClusters', () => {
  it('keeps a letter and its points in one cell', () => {
    // בְּ is one act of writing — the bet, its dagesh and its sheva together.
    // Three cells would ask the student for something nobody writes.
    const clusters = splitClusters('בְּ');

    expect(clusters).toHaveLength(1);
    expect(clusters[0].text).toBe('בְּ');
    expect(clusters[0].base).toBe('ב');
    expect(clusters[0].pointed).toBe(true);
  });

  it('gives every consonant of a pointed word its own cell', () => {
    // דָּבָר — three consonants, each carrying a vowel.
    const clusters = splitClusters('דָּבָר');

    expect(clusters.map(c => c.base)).toEqual(['ד', 'ב', 'ר']);
    expect(clusters.map(c => c.text)).toEqual(['דָּ', 'בָ', 'ר']);
  });

  it('returns clusters in logical order, not visual order', () => {
    // The grid lays cells out right-to-left from `ScriptPack.direction`.
    // Reversing here as well would put the word back the wrong way round.
    expect(splitClusters('דָּבָר')[0].base).toBe('ד');
  });

  it('marks an unpointed consonant as such', () => {
    const [cluster] = splitClusters('ר');

    expect(cluster.pointed).toBe(false);
    expect(cluster.text).toBe(cluster.base);
  });

  it('splits an unpointed word into bare consonants', () => {
    expect(splitClusters('דבר').map(c => c.text)).toEqual(['ד', 'ב', 'ר']);
  });

  it('treats a Greek breathing the same way, without knowing it is Greek', () => {
    // The rule is Unicode's, not Hebrew's. An alpha carrying a rough breathing
    // and an acute is one cell for the same reason \u05d1\u05b0\u05bc is — which is what lets
    // greek.tools inherit the grid (#105) with no engine change.
    //
    // Spelled with escapes deliberately. Composed U+1F05 and this decomposition
    // are indistinguishable in source, and only the decomposed form exercises
    // the rule at all; written as a literal, an editor or a normalization pass
    // could quietly turn this into an assertion about a single codepoint.
    const clusters = splitClusters('\u03b1\u0314\u0301');

    expect(clusters).toHaveLength(1);
    expect(clusters[0].base).toBe('\u03b1');
    expect(clusters[0].pointed).toBe(true);
  });

  it('leaves a precomposed character as the one cell it already is', () => {
    // The other half of the same claim: nothing here decomposes anything, so a
    // font-ready composed form passes through untouched.
    expect(splitClusters('\u1f05')).toEqual([
      { text: '\u1f05', base: '\u1f05', pointed: false },
    ]);
  });

  it('is empty for an empty string', () => {
    expect(splitClusters('')).toEqual([]);
  });

  it('keeps a leading combining mark rather than dropping it', () => {
    // Malformed input, but silently losing part of a word is worse than
    // showing an odd cell.
    expect(splitClusters('ְב')).toHaveLength(2);
  });
});
