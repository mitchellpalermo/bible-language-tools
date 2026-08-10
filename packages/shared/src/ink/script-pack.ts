// ScriptPack — everything language-specific about handwriting practice.
//
// The rest of `ink/` never mentions Hebrew or Greek. A new script is a new data
// file: glyphs, a font, a direction, and metrics. If porting to another script
// ever requires editing a module in this folder, that is a defect in this
// abstraction and the fix belongs here, generalized — not special-cased in the
// app.

/** A single practiceable mark: a letter, a final form, or a vowel point. */
export interface WritableGlyph {
  /**
   * The glyph's identity — what it IS, and what its SRS card is keyed by.
   * Combining marks are stored bare (e.g. the qamets alone); the pack's
   * `combining.hostChar` supplies the consonant they are drawn on.
   *
   * This is not necessarily what gets drawn. See `referenceForm`.
   */
  char: string;

  /**
   * What the student actually writes, when that differs from `char`.
   *
   * Some letters effectively never appear bare in running text, so a chart
   * built from bare codepoints teaches a form nobody writes. Hebrew's final
   * kaf is the case in point: it closes a syllable, so it carries a silent
   * sheva (ךְ) essentially everywhere it occurs.
   *
   * Resolve this through `renderableText()` rather than reading `char`
   * directly — that keeps one place to get it right, for display now and for
   * mask rasterization and stroke templates later.
   */
  referenceForm?: string;
  /** Conventional name, as a textbook would say it aloud — 'alef', 'qamets'. */
  name: string;
  /** Transliteration or sound value. Used as the recall-mode prompt. */
  phonetic?: string;
  /** Grouping for deck construction. */
  group: 'consonant' | 'final' | 'vowel' | 'other';
  /** Glyphs this one is commonly confused with. Drives the interleaved decks. */
  confusableWith?: string[];
  /** Short teaching note shown alongside the reference. */
  note?: string;
}

/**
 * Font-relative geometry, in the same units as `emBox`.
 *
 * Used to place the reference glyph consistently: Hebrew sits on a baseline
 * with almost no ascender and a small descender (ק, ן), which is a different
 * vertical rhythm from Greek and cannot be hardcoded in the renderer.
 */
export interface ScriptMetrics {
  emBox: number;
  baseline: number;
  ascender: number;
  descender: number;
}

export interface ScriptPack {
  id: string;
  label: string;
  /** Drives guide-box fill order and reference layout. */
  direction: 'rtl' | 'ltr';
  /** CSS font-family value for rendering the reference glyph. */
  fontFamily: string;
  /**
   * A CSS font shorthand for `document.fonts.load()`.
   *
   * This must be awaited before the reference glyph is rendered — and, later,
   * before it is rasterized for mask scoring. Skipping it silently draws (and
   * grades against) a fallback font.
   */
  fontLoadSpec: string;
  glyphs: WritableGlyph[];
  /** Marks that attach to a host consonant — nikud, or Greek breathings. */
  combining?: { hostChar: string; marks: WritableGlyph[] };
  metrics: ScriptMetrics;
}

/** All glyphs in a pack, including combining marks composed onto their host. */
export function allGlyphs(pack: ScriptPack): WritableGlyph[] {
  return pack.combining ? [...pack.glyphs, ...pack.combining.marks] : [...pack.glyphs];
}

/**
 * The string to draw for a glyph.
 *
 * The single place that decides what a student sees and traces: combining
 * marks get their host consonant prefixed, and anything with a `referenceForm`
 * renders that instead of its bare identity. Every consumer — the canvas, the
 * prompt, and later the scoring rasterizer — must go through here.
 */
export function renderableText(pack: ScriptPack, glyph: WritableGlyph): string {
  if (glyph.group === 'vowel' && pack.combining) return pack.combining.hostChar + glyph.char;
  return glyph.referenceForm ?? glyph.char;
}

/** Glyphs in a named group, in pack order. */
export function glyphsInGroup(pack: ScriptPack, group: WritableGlyph['group']): WritableGlyph[] {
  return allGlyphs(pack).filter(g => g.group === group);
}
