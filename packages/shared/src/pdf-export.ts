/**
 * The translation-practice PDF, for either language (#62 on greek.tools, #227
 * on hebrew.tools).
 *
 * An app turns a passage into `ExportVerse`s — each verse a list of word
 * tokens, already in the form it should print — and says which script it is:
 * its font, its direction, and whether that script needs its combining marks
 * placed by hand. This module owns everything else: the page, the wrapping,
 * the ruled lines for the student's translation, the page breaks.
 *
 * Nothing here names a language. What differs is data (`ExportOptions`).
 *
 * ## Why Hebrew needs `clusterShaper`
 *
 * `pdf-lib` embeds a font through fontkit but reads only the glyph ids out of
 * its layout and throws the positions away. For Greek that costs nothing. For
 * pointed Hebrew it is fatal: vowel points and accents are zero-width glyphs
 * that the font places with GPOS mark attachment, so without the positions
 * every mark lands on the pen position — on the wrong side of the letter, or
 * piled on its neighbour. The Hebrew in such a PDF reads as noise.
 *
 * `clusterShaper` therefore shapes one *cluster* at a time — a base character
 * and the combining marks after it, which is the unit of writing and the same
 * rule `splitClusters` uses in the ink engine — and draws each glyph at the
 * offset fontkit computed. It shapes every cluster left-to-right and places the
 * clusters right-to-left itself. Shaping a whole RTL string through fontkit
 * instead returns the glyphs already reversed with their offsets still computed
 * for the logical order, and the marks come out displaced.
 */

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';

// ─── Types ────────────────────────────────────────────────────────────────────

/** One verse, ready to print: each word as the string to draw, in reading order. */
export interface ExportVerse {
  chapter: number;
  verse: number;
  words: string[];
}

export type TextDirection = 'ltr' | 'rtl';

/** Measures and draws a run of the passage's script. */
export interface ScriptShaper {
  /** Advance width of `text` at `size`, in points. */
  width(text: string, size: number): number;
  /**
   * Draw `text` with its *leading* edge at `x` — the left edge in LTR, the
   * right edge in RTL — so a caller lays a line out without knowing which.
   */
  draw(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    size: number,
    color: ReturnType<typeof rgb>,
  ): void;
}

export interface ExportOptions {
  verses: ExportVerse[];
  /** The passage reference, printed at the top of the first page. */
  title: string;
  /** The script's font, as a TrueType file. */
  fontBytes: Uint8Array | ArrayBuffer;
  direction: TextDirection;
  /**
   * `'simple'` hands the text to pdf-lib as is. `'clustered'` places every
   * combining mark itself, which pointed Hebrew needs and Greek does not. See
   * the header.
   */
  shaping: 'simple' | 'clustered';
  /** OpenType script tag for `'clustered'` shaping — `hebr`. */
  scriptTag?: string;
  /**
   * A character the font must have a glyph for. A font that lacks the script
   * draws every letter as a blank box and gives no error, so the builder checks
   * before it draws anything.
   */
  requiredCodePoint?: number;
  /** Printed at the foot of every page. */
  watermark: string;
  /** Prefix for a chapter's heading; `Chapter` gives "Chapter 3". */
  chapterLabel?: string;
  /**
   * The face for the heading, verse numbers and watermark. Greek's font covers
   * Latin too, so it asks for `script` and the file is embedded once. A script
   * font with no Latin letters (Noto Sans Hebrew) passes `chromeFontBytes`
   * instead, so both apps print their chrome in the same face. With neither,
   * Helvetica, which needs no file.
   */
  chromeFont?: 'script' | 'helvetica';
  chromeFontBytes?: Uint8Array | ArrayBuffer;
  /**
   * A line of the script printed on the title row opposite the reference: the
   * Hebrew name of the book. It sits at the script's leading edge, so in RTL
   * at the right margin, above the verse numbers.
   */
  titleScript?: string;
  /** Points. Default 13; Hebrew wants more room for its points and accents. */
  scriptSize?: number;
  /** Distance from the script baseline to the first ruled line. */
  scriptLeading?: number;
}

// ─── Page constants (Letter, points) ─────────────────────────────────────────

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 54;
const MARGIN_R = 54;
const MARGIN_T = 72;
const MARGIN_B = 54;
export const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R; // 504pt

const FONT_REF = 9;
const FONT_HEADING = 10;
const TITLE_SCRIPT_SIZE = 14;

export const DEFAULT_SCRIPT_SIZE = 13;
export const DEFAULT_SCRIPT_LEADING = 18;
const RULE_SPACING = 22;
export const RULE_COUNT = 2;
const AFTER_RULES_GAP = 4;
const VERSE_GAP = 6;
const CHAPTER_HEADING_H = 20;

/** Vertical space one line of script and its ruled writing lines consume. */
export function lineBlockHeight(scriptLeading = DEFAULT_SCRIPT_LEADING): number {
  return scriptLeading + RULE_COUNT * RULE_SPACING + AFTER_RULES_GAP;
}

export const LINE_BLOCK_H = lineBlockHeight();

// ─── Word wrapping ────────────────────────────────────────────────────────────

/**
 * Each returned array is one line of words that fits within the given width.
 * `firstLineMaxWidth` accommodates a verse-number prefix on the first line.
 * A word wider than the line still gets a line of its own.
 */
export function wrapWords(
  words: string[],
  widthOf: (text: string) => number,
  maxWidth: number,
  firstLineMaxWidth = maxWidth,
): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let currentWidth = 0;
  let firstLine = true;

  for (const word of words) {
    const w = widthOf(`${word} `);
    const limit = firstLine ? firstLineMaxWidth : maxWidth;
    if (current.length > 0 && currentWidth + w > limit) {
      lines.push(current);
      current = [word];
      currentWidth = w;
      firstLine = false;
    } else {
      current.push(word);
      currentWidth += w;
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

// ─── Shaping ──────────────────────────────────────────────────────────────────

/** A base character with the combining marks that follow it. */
export function splitClusters(text: string): string[] {
  return text.match(/\P{M}\p{M}*/gu) ?? [];
}

/** The shaper for a script that needs no help: pdf-lib's own layout. */
export function simpleShaper(font: PDFFont, direction: TextDirection): ScriptShaper {
  return {
    width: (text, size) => font.widthOfTextAtSize(text, size),
    draw(page, text, x, y, size, color) {
      const w = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: direction === 'rtl' ? x - w : x, y, size, font, color });
    },
  };
}

interface GlyphPlacement {
  codePoints: number[];
  xAdvance: number;
  xOffset: number;
  yOffset: number;
}

interface ShapedCluster {
  glyphs: GlyphPlacement[];
  /** Advance in font units. */
  advance: number;
}

/**
 * Shape a script whose marks the font attaches with GPOS, one cluster at a
 * time (see the header). Clusters are laid out in the order `direction` says.
 */
export function clusterShaper(
  pdfFont: PDFFont,
  fontBytes: Uint8Array,
  direction: TextDirection,
  scriptTag: string,
): ScriptShaper {
  const font = fontkit.create(fontBytes);
  const unitsPerEm = font.unitsPerEm;
  const cache = new Map<string, ShapedCluster>();

  function shape(cluster: string): ShapedCluster {
    const hit = cache.get(cluster);
    if (hit) return hit;
    // Typed in @pdf-lib/fontkit as (string, features) only; the script and
    // direction are what make the shaper apply the script's own features
    // left-to-right, the frame the offsets are computed in.
    const layout = font.layout as unknown as (
      s: string,
      features: undefined,
      script: string,
      language: undefined,
      dir: 'ltr',
    ) => { glyphs: { codePoints: number[] }[]; positions: ShapedPosition[] };
    const run = layout.call(font, cluster, undefined, scriptTag, undefined, 'ltr');
    const shaped: ShapedCluster = {
      glyphs: run.glyphs.map((g, i) => ({
        codePoints: g.codePoints,
        xAdvance: run.positions[i].xAdvance,
        xOffset: run.positions[i].xOffset,
        yOffset: run.positions[i].yOffset,
      })),
      advance: run.positions.reduce((sum, p) => sum + p.xAdvance, 0),
    };
    cache.set(cluster, shaped);
    return shaped;
  }

  const widthUnits = (text: string) =>
    splitClusters(text).reduce((sum, c) => sum + shape(c).advance, 0);

  return {
    width: (text, size) => (widthUnits(text) * size) / unitsPerEm,
    draw(page, text, x, y, size, color) {
      const k = size / unitsPerEm;
      // Walk the clusters in reading order from the leading edge. In RTL each
      // cluster's left edge is the pen minus its advance.
      let pen = x;
      for (const cluster of splitClusters(text)) {
        const shaped = shape(cluster);
        // An offset is relative to the pen *after* the advances before it — a
        // mark follows its base, so its (negative) offset walks back onto it.
        let glyphPen = direction === 'rtl' ? pen - shaped.advance * k : pen;
        for (const glyph of shaped.glyphs) {
          if (glyph.codePoints.length > 0) {
            page.drawText(String.fromCodePoint(...glyph.codePoints), {
              x: glyphPen + glyph.xOffset * k,
              y: y + glyph.yOffset * k,
              size,
              font: pdfFont,
              color,
            });
          }
          glyphPen += glyph.xAdvance * k;
        }
        pen += (direction === 'rtl' ? -1 : 1) * shaped.advance * k;
      }
    },
  };
}

interface ShapedPosition {
  xAdvance: number;
  xOffset: number;
  yOffset: number;
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

const toBytes = (b: Uint8Array | ArrayBuffer): Uint8Array =>
  b instanceof Uint8Array ? b : new Uint8Array(b);

export async function buildTranslationPDF(options: ExportOptions): Promise<Uint8Array> {
  const {
    verses,
    title,
    direction,
    shaping,
    watermark,
    chapterLabel = 'Chapter',
    scriptSize = DEFAULT_SCRIPT_SIZE,
    scriptLeading = DEFAULT_SCRIPT_LEADING,
  } = options;
  const rtl = direction === 'rtl';
  const blockH = lineBlockHeight(scriptLeading);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // subset:true drops polytonic Greek glyphs (fontkit GSUB bug) and would strip
  // the glyphs a Hebrew mark is drawn from — embed the full font.
  const fontBytes = toBytes(options.fontBytes);
  const scriptFont = await doc.embedFont(fontBytes);
  if (options.requiredCodePoint !== undefined) {
    const probe = fontkit.create(fontBytes);
    if (!probe.hasGlyphForCodePoint(options.requiredCodePoint)) {
      throw new Error('The font has no glyphs for this script; the PDF would be blank boxes.');
    }
  }
  const chromeFont = options.chromeFontBytes
    ? await doc.embedFont(toBytes(options.chromeFontBytes))
    : options.chromeFont === 'script'
      ? scriptFont
      : await doc.embedFont(StandardFonts.Helvetica);

  const shaper =
    shaping === 'clustered'
      ? clusterShaper(scriptFont, fontBytes, direction, options.scriptTag ?? 'DFLT')
      : simpleShaper(scriptFont, direction);

  const textColor = rgb(0.05, 0.05, 0.05);
  const refColor = rgb(0.5, 0.5, 0.5);
  const ruleColor = rgb(0.78, 0.78, 0.78);
  const headingColor = rgb(0.4, 0.4, 0.4);
  const watermarkColor = rgb(0.75, 0.75, 0.75);
  const WATERMARK_SIZE = 8;

  function addPage() {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    const ww = chromeFont.widthOfTextAtSize(watermark, WATERMARK_SIZE);
    p.drawText(watermark, {
      x: (PAGE_W - ww) / 2,
      y: 20,
      size: WATERMARK_SIZE,
      font: chromeFont,
      color: watermarkColor,
    });
    return p;
  }

  /**
   * A heading, in the chrome face. `atStart` puts it at the leading edge — the
   * right margin in RTL, where the verse numbers are — otherwise at the left
   * margin, where greek.tools puts every heading.
   */
  function drawChrome(p: PDFPage, text: string, y: number, size: number, atStart: boolean) {
    const w = chromeFont.widthOfTextAtSize(text, size);
    p.drawText(text, {
      x: rtl && atStart ? PAGE_W - MARGIN_R - w : MARGIN_L,
      y,
      size,
      font: chromeFont,
      color: headingColor,
    });
  }

  // The edge a line starts from, and the way its words run.
  const lineStart = rtl ? PAGE_W - MARGIN_R : MARGIN_L;
  const sign = rtl ? -1 : 1;

  let page: PDFPage = addPage();
  let y = PAGE_H - MARGIN_T;

  // The reference is at the left margin in both languages, exactly as on
  // greek.tools; the script name of the book takes the opposite end.
  drawChrome(page, title, y, FONT_HEADING + 1, false);
  if (options.titleScript) {
    shaper.draw(page, options.titleScript, lineStart, y, TITLE_SCRIPT_SIZE, headingColor);
  }
  y -= CHAPTER_HEADING_H + 6;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN_B) {
      page = addPage();
      y = PAGE_H - MARGIN_T;
    }
  }

  let lastChapter = -1;

  for (const { chapter, verse, words } of verses) {
    if (chapter !== lastChapter) {
      ensureSpace(CHAPTER_HEADING_H + blockH);
      if (lastChapter !== -1) y -= VERSE_GAP;
      drawChrome(page, `${chapterLabel} ${chapter}`, y, FONT_HEADING, true);
      y -= CHAPTER_HEADING_H;
      lastChapter = chapter;
    }

    const verseNumStr = `${verse} `;
    const verseNumWidth = chromeFont.widthOfTextAtSize(verseNumStr, FONT_REF);

    const lines = wrapWords(
      words,
      (t) => shaper.width(t, scriptSize),
      CONTENT_W,
      CONTENT_W - verseNumWidth,
    );

    // An empty verse is one blank block, so its number still appears.
    const lineCount = lines.length || 1;

    for (let i = 0; i < lineCount; i++) {
      ensureSpace(blockH);

      if (i === 0) {
        page.drawText(verseNumStr, {
          // In RTL the number's glyphs sit against the margin and its trailing
          // space is the gap to the text on their left.
          x: rtl ? lineStart - chromeFont.widthOfTextAtSize(`${verse}`, FONT_REF) : lineStart,
          y: y + 3,
          size: FONT_REF,
          font: chromeFont,
          color: refColor,
        });
      }

      if (lines[i]) {
        const offset = i === 0 ? verseNumWidth : 0;
        shaper.draw(page, lines[i].join(' '), lineStart + sign * offset, y, scriptSize, textColor);
      }

      for (let r = 0; r < RULE_COUNT; r++) {
        const ruleY = y - scriptLeading - r * RULE_SPACING;
        page.drawLine({
          start: { x: MARGIN_L, y: ruleY },
          end: { x: PAGE_W - MARGIN_R, y: ruleY },
          thickness: 0.4,
          color: ruleColor,
        });
      }

      y -= blockH;
    }

    y -= VERSE_GAP;
  }

  // Object streams would hide the font dictionaries inside a compressed
  // stream; leaving them out costs a few KB and lets a test (or `pdffonts`)
  // see which face was embedded.
  return doc.save({ useObjectStreams: false });
}
