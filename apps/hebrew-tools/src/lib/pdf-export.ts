/**
 * What `/export` prints (#227): a passage of the Hebrew Bible set for
 * translation practice. The page layout is `@tools/shared/pdf-export`; this
 * file is what is Hebrew — which verses, how pointed, and the font.
 *
 * Cantillation is stripped for output only, through the same
 * `stripCantillation` the reader's toggle uses, so the PDF shows what the
 * reader showed when the student set the same options.
 */

import { buildTranslationPDF, type ExportVerse } from '@tools/shared/pdf-export';
import { type HebrewBook, type HebrewWord, readingText } from '../data/morphhb';
import { stripCantillation } from './hebrew-input';
import { accentUnits } from './reader';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportRange {
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

export interface ExportVerseWords {
  chapter: number;
  verse: number;
  words: HebrewWord[];
}

/** How much of the text's marking to print. */
export interface ExportOptions {
  /** `pointed` keeps the vowels; `consonants` prints bare letters. */
  pointing: 'pointed' | 'consonants';
  /** Print the te'amim. Ignored for `consonants`, which has none to show. */
  cantillation: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = { pointing: 'pointed', cantillation: true };

// ─── Range ────────────────────────────────────────────────────────────────────

/** The verses of a book that a range covers, in order. */
export function extractVerses(book: HebrewBook, range: ExportRange): ExportVerseWords[] {
  const result: ExportVerseWords[] = [];

  for (let ch = range.startChapter; ch <= range.endChapter; ch++) {
    const chapter = book[String(ch)];
    if (!chapter) continue;

    const numbers = Object.keys(chapter)
      .map(Number)
      .sort((a, b) => a - b);

    for (const v of numbers) {
      if (ch === range.startChapter && v < range.startVerse) continue;
      if (ch === range.endChapter && v > range.endVerse) continue;
      result.push({ chapter: ch, verse: v, words: chapter[String(v)] ?? [] });
    }
  }

  return result;
}

/** The highest verse number in a chapter; 1 where the chapter is unknown. */
export function lastVerse(book: HebrewBook | null, chapter: number): number {
  const verses = book?.[String(chapter)];
  if (!verses) return 1;
  return Math.max(1, ...Object.keys(verses).map(Number));
}

/**
 * Make a range coherent after one of its ends changed: verses inside their
 * chapter, the end not before the start.
 */
export function normalizeRange(range: ExportRange, book: HebrewBook | null): ExportRange {
  // Until the book has loaded there is nothing to clamp against.
  const cap = (chapter: number) => (book ? lastVerse(book, chapter) : Number.POSITIVE_INFINITY);
  const startVerse = clamp(range.startVerse, 1, cap(range.startChapter));
  const endChapter = Math.max(range.endChapter, range.startChapter);
  let endVerse = clamp(range.endVerse, 1, cap(endChapter));
  if (endChapter === range.startChapter) endVerse = Math.max(endVerse, startVerse);
  return { ...range, startVerse, endChapter, endVerse };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), Math.max(lo, hi));
}

/** `Genesis 1:1`, `Genesis 1:1–5`, `Genesis 1:1–2:3`. */
export function formatPassageRef(bookName: string, r: ExportRange): string {
  const { startChapter: sc, startVerse: sv, endChapter: ec, endVerse: ev } = r;
  if (sc === ec && sv === ev) return `${bookName} ${sc}:${sv}`;
  if (sc === ec) return `${bookName} ${sc}:${sv}–${ev}`;
  return `${bookName} ${sc}:${sv}–${ec}:${ev}`;
}

/** A file name for the download, from the passage reference. */
export function exportFilename(passageRef: string): string {
  const slug = passageRef
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'passage'}-hebrew.pdf`;
}

// ─── Text ─────────────────────────────────────────────────────────────────────

/**
 * Vowel points and the shin and sin dots: U+05B0–U+05BD, U+05BF, U+05C1–U+05C2,
 * U+05C4–U+05C5, U+05C7. Written as a list rather than a range because the
 * range `stripNikud` uses (05B0–05C7) also takes maqqef (U+05BE), which joins
 * two words and must survive in consonants-only text.
 */
const POINTS = /[ְ-ׇֽֿׁׂׅׄ]/g;

/** The text of a word as it prints under `options`. */
export function exportText(word: HebrewWord, options: ExportOptions): string {
  const text = readingText(word);
  if (options.pointing === 'consonants') return stripCantillation(text).replace(POINTS, '');
  return options.cantillation ? text : stripCantillation(text);
}

/**
 * A verse as the tokens a line may break between.
 *
 * A maqqef binds its words into one accentual unit, so `accentUnits` groups them
 * and each group is one token, exactly as in the reader. A word's `after` — the
 * maqqef, paseq or sof pasuq that trails it — prints with it.
 */
export function toExportVerses(verses: ExportVerseWords[], options: ExportOptions): ExportVerse[] {
  return verses.map(({ chapter, verse, words }) => ({
    chapter,
    verse,
    words: accentUnits(words).map((unit) =>
      unit.map((w) => exportText(w, options) + (w.after ?? '')).join(''),
    ),
  }));
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export const HEBREW_FONT_URL = '/fonts/NotoSansHebrew-Regular.ttf';
const ALEF = 0x05d0;

/** Hebrew set larger and more loosely than Greek: points and accents need room. */
const HEBREW_SIZE = 18;
const HEBREW_LEADING = 30;

/** Fetch the font, and refuse to go on with something that is not a font. */
export async function loadHebrewFont(): Promise<Uint8Array> {
  const res = await fetch(HEBREW_FONT_URL);
  if (!res.ok) throw new Error(`Could not load the Hebrew font: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // A TrueType file opens with 0x00010000, an OpenType one with "OTTO". A host
  // that answers with its HTML 404 page at HTTP 200 would otherwise surface as
  // an unreadable error out of the PDF library.
  const magic = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  if (magic !== 0x00010000 && magic !== 0x4f54544f) {
    throw new Error('The Hebrew font did not load; the PDF would have no Hebrew in it.');
  }
  return bytes;
}

export async function buildHebrewPDF(
  verses: ExportVerseWords[],
  passageRef: string,
  options: ExportOptions,
): Promise<Uint8Array> {
  const fontBytes = await loadHebrewFont();
  return buildTranslationPDF({
    verses: toExportVerses(verses, options),
    title: passageRef,
    fontBytes,
    direction: 'rtl',
    shaping: 'clustered',
    scriptTag: 'hebr',
    requiredCodePoint: ALEF,
    watermark: 'hebrew.tools',
    scriptSize: HEBREW_SIZE,
    scriptLeading: HEBREW_LEADING,
  });
}
