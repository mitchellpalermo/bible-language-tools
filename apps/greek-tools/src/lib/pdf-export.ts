import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFPage, rgb } from 'pdf-lib';
import type { CrossChapterRange } from '../components/CrossChapterSelector';
import type { MorphBook, MorphWord } from '../data/morphgnt';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerseForExport {
  chapter: number;
  verse: number;
  words: MorphWord[];
}

// ─── Page constants (Letter, points) ─────────────────────────────────────────

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 54;
const MARGIN_R = 54;
const MARGIN_T = 72;
const MARGIN_B = 54;
export const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R; // 504pt

const FONT_GREEK = 13;
const FONT_REF = 9;
const FONT_HEADING = 10;

const GREEK_LEADING = 18;
const RULE_SPACING = 22;
export const RULE_COUNT = 2;
const AFTER_RULES_GAP = 4;
const VERSE_GAP = 6;
const CHAPTER_HEADING_H = 20;

// Vertical space consumed by one Greek line + its ruled writing lines
export const LINE_BLOCK_H = GREEK_LEADING + RULE_COUNT * RULE_SPACING + AFTER_RULES_GAP;

// ─── Data extraction ──────────────────────────────────────────────────────────

export function extractVerses(bookData: MorphBook, range: CrossChapterRange): VerseForExport[] {
  const result: VerseForExport[] = [];

  for (let ch = range.startChapter; ch <= range.endChapter; ch++) {
    const chapter = bookData[String(ch)];
    if (!chapter) continue;

    const verseNums = Object.keys(chapter)
      .map(Number)
      .sort((a, b) => a - b);

    for (const v of verseNums) {
      if (ch === range.startChapter && v < range.startVerse) continue;
      if (ch === range.endChapter && v > range.endVerse) continue;
      result.push({ chapter: ch, verse: v, words: chapter[String(v)] ?? [] });
    }
  }

  return result;
}

// ─── Word wrapping ────────────────────────────────────────────────────────────

// Each returned array is one line of words that fits within the given width.
// firstLineMaxWidth accommodates a verse-number prefix on the first line.
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

// ─── PDF builder ──────────────────────────────────────────────────────────────

export async function buildTranslationPDF(
  verses: VerseForExport[],
  passageRef: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fontBytes = await fetch('/fonts/NotoSans-Regular.ttf').then((r) => r.arrayBuffer());
  // subset:true drops polytonic Greek glyphs (fontkit GSUB bug) — embed full font
  const font = await doc.embedFont(fontBytes);

  const textColor = rgb(0.05, 0.05, 0.05);
  const refColor = rgb(0.5, 0.5, 0.5);
  const ruleColor = rgb(0.78, 0.78, 0.78);
  const headingColor = rgb(0.4, 0.4, 0.4);

  const watermarkColor = rgb(0.75, 0.75, 0.75);
  const WATERMARK = 'greek.tools';
  const WATERMARK_SIZE = 8;

  function addPage() {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    const ww = font.widthOfTextAtSize(WATERMARK, WATERMARK_SIZE);
    p.drawText(WATERMARK, {
      x: (PAGE_W - ww) / 2,
      y: 20,
      size: WATERMARK_SIZE,
      font,
      color: watermarkColor,
    });
    return p;
  }

  let page: PDFPage = addPage();
  let y = PAGE_H - MARGIN_T;

  // Page title
  page.drawText(passageRef, {
    x: MARGIN_L,
    y,
    size: FONT_HEADING + 1,
    font,
    color: headingColor,
  });
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
      ensureSpace(CHAPTER_HEADING_H + LINE_BLOCK_H);
      if (lastChapter !== -1) y -= VERSE_GAP;
      page.drawText(`Chapter ${chapter}`, {
        x: MARGIN_L,
        y,
        size: FONT_HEADING,
        font,
        color: headingColor,
      });
      y -= CHAPTER_HEADING_H;
      lastChapter = chapter;
    }

    const verseNumStr = `${verse} `;
    const verseNumWidth = font.widthOfTextAtSize(verseNumStr, FONT_REF);
    const firstLineW = CONTENT_W - verseNumWidth;

    const lines = wrapWords(
      words.map((w) => w.text),
      (t) => font.widthOfTextAtSize(t, FONT_GREEK),
      CONTENT_W,
      firstLineW,
    );

    // Treat an empty verse as one blank block so the verse ref still appears
    const lineCount = lines.length || 1;

    for (let i = 0; i < lineCount; i++) {
      ensureSpace(LINE_BLOCK_H);

      if (i === 0) {
        page.drawText(verseNumStr, {
          x: MARGIN_L,
          y: y + 3,
          size: FONT_REF,
          font,
          color: refColor,
        });
      }

      if (lines[i]) {
        page.drawText(lines[i].join(' '), {
          x: i === 0 ? MARGIN_L + verseNumWidth : MARGIN_L,
          y,
          size: FONT_GREEK,
          font,
          color: textColor,
        });
      }

      for (let r = 0; r < RULE_COUNT; r++) {
        const ruleY = y - GREEK_LEADING - r * RULE_SPACING;
        page.drawLine({
          start: { x: MARGIN_L, y: ruleY },
          end: { x: PAGE_W - MARGIN_R, y: ruleY },
          thickness: 0.4,
          color: ruleColor,
        });
      }

      y -= LINE_BLOCK_H;
    }

    y -= VERSE_GAP;
  }

  return doc.save();
}
