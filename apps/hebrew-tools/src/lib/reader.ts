/**
 * Pure logic behind `/reader`: what passage is being read, how its reference
 * reads in Hebrew, where a line is allowed to break, and where a word's popup
 * sits.
 *
 * `HebrewReader.tsx` owns fetching, state and DOM; everything here is a
 * function over values, the same split as `nav-menu.ts` and the ink engine.
 */

import type { HebrewWord } from '../data/morphhb';

// ─── Passage references ───────────────────────────────────────────────────────

export interface PassageRef {
  /** Paratext/USFM book code — `GEN`, `1SA`, `PSA`. */
  book: string;
  chapter: number;
  /** Present only when the reference names one, as `GEN.1.1` does. */
  verse?: number;
}

/** Genesis 1, because a Hebrew reader opens where the Hebrew Bible does. */
export const DEFAULT_REF: PassageRef = { book: 'GEN', chapter: 1 };

/** `GEN`, `1SA`, `PSA` — three characters, the first possibly a digit. */
const BOOK_CODE = /^[0-9A-Z]{3}$/;

/**
 * Read a `?ref=` value.
 *
 * Anything malformed falls back rather than throwing: a hand-edited URL is a
 * typo, not an error state, and a reader that opens at Genesis is a better
 * answer than one that opens at a stack trace. A recognizable book with a bad
 * chapter keeps the book.
 */
export function parseRef(ref: string | null | undefined): PassageRef {
  if (!ref) return DEFAULT_REF;
  const [book, chapter, verse] = ref.split('.');
  if (!BOOK_CODE.test(book)) return DEFAULT_REF;
  return {
    book,
    chapter: positive(chapter) ?? DEFAULT_REF.chapter,
    ...(positive(verse) === undefined ? {} : { verse: positive(verse) }),
  };
}

function positive(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 ? n : undefined;
}

/** The inverse: `GEN.1`, or `GEN.1.1` when a verse is named. */
export function formatRef({ book, chapter, verse }: PassageRef): string {
  return verse === undefined ? `${book}.${chapter}` : `${book}.${chapter}.${verse}`;
}

// ─── Hebrew numerals ──────────────────────────────────────────────────────────

const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

/**
 * A chapter number as Hebrew books number their chapters — 1 is א, 150 is קנ.
 *
 * **15 and 16 are טו and טז, not יה and יו.** Written the regular way they
 * would spell the first two letters of the divine name, and Hebrew numbering
 * has avoided that for centuries. A printed Tanakh writes Psalm 15 as תהלים טו,
 * so a reader that wrote יה there would be visibly wrong to anyone who has held
 * one.
 *
 * Values outside 1–999 come back as digits. Nothing in the Hebrew Bible reaches
 * them — Psalms has 150 chapters and Psalm 119 has 176 verses, the two largest
 * numbers in the text — so this is a guard, not a feature.
 */
export function hebrewNumeral(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) return String(n);

  let out = '';
  let rest = n;
  // No letter stands for 500 and up; they are written as repeated tavs.
  while (rest >= 400) {
    out += 'ת';
    rest -= 400;
  }
  out += HUNDREDS[Math.floor(rest / 100)];
  rest %= 100;

  if (rest === 15) return `${out}טו`;
  if (rest === 16) return `${out}טז`;
  return out + TENS[Math.floor(rest / 10)] + ONES[rest % 10];
}

// ─── Line breaking ────────────────────────────────────────────────────────────

/** U+05BE HEBREW PUNCTUATION MAQAF. */
export const MAQQEF = '־';

/**
 * Group a verse's words into the units a line may break between.
 *
 * A maqqef is not a hyphen and not a space: it binds the words it joins into a
 * single accentual unit, pronounced under one stress. `עַל־כֵּן` is one word to
 * the ear, and letting a line break inside it would be a typographic error the
 * printed text never makes. Every other word stands alone.
 *
 * Returned as groups rather than as a flag on each word so the renderer can
 * wrap each group in one non-breaking span and stay ignorant of the rule.
 */
export function accentUnits(words: HebrewWord[]): HebrewWord[][] {
  const units: HebrewWord[][] = [];
  let current: HebrewWord[] = [];

  for (const word of words) {
    current.push(word);
    if (word.after !== MAQQEF) {
      units.push(current);
      current = [];
    }
  }
  // A verse ending on a maqqef is malformed, but dropping its last words to
  // say so would be worse than rendering them.
  if (current.length > 0) units.push(current);

  return units;
}

// ─── Word popup placement ─────────────────────────────────────────────────────

/** The popup's width wherever the viewport has room for it. */
export const POPUP_WIDTH = 288;
/** Clearance between the popup and the edge of the viewport. */
const POPUP_MARGIN = 8;
/** The gap between the word and the popup below it. */
const POPUP_GAP = 6;

/** What the caller measured of the word: `getBoundingClientRect`, viewport-relative. */
export interface WordRect {
  right: number;
  bottom: number;
}

/** The viewport the popup has to fit inside, and how far the page is scrolled. */
export interface Viewport {
  width: number;
  scrollX: number;
  scrollY: number;
}

/** Where to put the popup, in page coordinates — it is positioned absolutely. */
export interface PopupBox {
  left: number;
  top: number;
  width: number;
}

/**
 * Place a word's popup below it, anchored to where the word *starts*.
 *
 * **In RTL a word starts at its right edge**, so the popup hangs leftward from
 * there — the mirror of greek.tools, which left-aligns the popup with the word
 * and would here drift away from the word it belongs to on every line.
 *
 * Two things greek.tools' clamp gets away with and this one does not:
 *
 * - **Clamping happens in viewport coordinates, and the scroll offset is added
 *   afterwards.** greek.tools compares a page x-coordinate against
 *   `window.innerWidth`, which is a viewport width; the two only agree while the
 *   page is not scrolled horizontally.
 * - **The popup narrows rather than overflowing.** A phone in portrait is
 *   narrower than `POPUP_WIDTH` plus its margins, and a fixed width there pushes
 *   the popup off the side of a page that must never scroll sideways.
 */
export function popupPosition(rect: WordRect, viewport: Viewport): PopupBox {
  const width = Math.min(POPUP_WIDTH, Math.max(0, viewport.width - 2 * POPUP_MARGIN));
  const rightmost = Math.max(POPUP_MARGIN, viewport.width - POPUP_MARGIN - width);
  const left = Math.min(Math.max(rect.right - width, POPUP_MARGIN), rightmost);

  return {
    left: left + viewport.scrollX,
    top: rect.bottom + viewport.scrollY + POPUP_GAP,
    width,
  };
}
