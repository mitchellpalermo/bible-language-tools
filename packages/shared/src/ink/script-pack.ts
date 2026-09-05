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

  /**
   * What is already on the page before this glyph's own mark goes down.
   *
   * Set it where a glyph is "some other glyph, plus a mark": שׁ is ש plus a
   * dot. Scoring uses it to isolate the mark and grade *where the student put
   * it*, which area-based metrics cannot do on their own — the shin dot is
   * under 1% of the letter's cells, so putting it on the wrong arm is nearly
   * free otherwise.
   *
   * Combining marks do not need this. Their base is the pack's
   * `combining.hostChar`, and `baseText()` supplies it.
   */
  baseForm?: string;

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

/**
 * The part of a glyph's rendering that is NOT the mark being drilled, or null
 * when the whole thing is.
 *
 * The counterpart to `renderableText`, and the second half of what placement
 * scoring needs: rasterize both, and the difference is the mark. Combining
 * marks resolve to the pack's host consonant; anything else has to say so with
 * `baseForm`.
 */
export function baseText(pack: ScriptPack, glyph: WritableGlyph): string | null {
  if (glyph.baseForm) return glyph.baseForm;
  if (glyph.group === 'vowel' && pack.combining) return pack.combining.hostChar;
  return null;
}

/** Glyphs in a named group, in pack order. */
export function glyphsInGroup(pack: ScriptPack, group: WritableGlyph['group']): WritableGlyph[] {
  return allGlyphs(pack).filter((g) => g.group === group);
}

/** One cell of a writing grid: a base character and the marks written on it. */
export interface GlyphCluster {
  /** What goes in the cell — the base character plus its combining marks. */
  text: string;
  /** The base character alone, with every mark stripped. */
  base: string;
  /** Whether the cluster carries any combining mark at all. */
  pointed: boolean;
}

/**
 * A combining mark: anything that attaches to the character before it.
 *
 * `\p{M}` rather than a Hebrew range, because this is a Unicode rule and not a
 * Hebrew one — nikud, a dagesh and a shin dot are nonspacing marks in exactly
 * the same sense as a Greek breathing or a combining acute. A script-specific
 * range here would be the abstraction leak `ScriptPack` exists to prevent.
 */
const COMBINING = /\p{M}/u;

/**
 * Split a word into the cells of a writing grid — one per consonant cluster.
 *
 * Grid cells are what remove ink segmentation from the problem: the student
 * says where each letter ends, so the engine never has to guess. That only
 * works if a cell holds a letter *with its points* — writing בְּ means writing
 * the bet, its dagesh and its sheva as one act, and splitting them into three
 * cells would ask for something nobody writes.
 *
 * Direction is not this function's business. Clusters come back in logical
 * order — first-written first — and the grid lays them out right-to-left or
 * left-to-right from `ScriptPack.direction`. Reversing here instead would
 * double-reverse the moment a caller rendered them into an RTL container.
 *
 * A leading combining mark has no base to attach to, which happens only in
 * malformed input; it becomes its own cluster rather than being dropped,
 * because silently discarding part of a word is worse than showing an odd cell.
 */
export function splitClusters(text: string): GlyphCluster[] {
  const clusters: GlyphCluster[] = [];

  for (const char of text) {
    const last = clusters[clusters.length - 1];
    if (last && COMBINING.test(char)) {
      last.text += char;
      last.pointed = true;
    } else {
      clusters.push({ text: char, base: char, pointed: false });
    }
  }

  return clusters;
}
