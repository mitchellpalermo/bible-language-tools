import type { DailyVerseRef } from './dailyVerses';

// ─── Book name → MorphGNT code ──────────────────────────────────────────────

export const BOOK_NAME_TO_CODE: Record<string, string> = {
  Matthew: 'MAT',
  Mark: 'MRK',
  Luke: 'LUK',
  John: 'JHN',
  Acts: 'ACT',
  Romans: 'ROM',
  '1 Corinthians': '1CO',
  '2 Corinthians': '2CO',
  Galatians: 'GAL',
  Ephesians: 'EPH',
  Philippians: 'PHP',
  Colossians: 'COL',
  '1 Thessalonians': '1TH',
  '2 Thessalonians': '2TH',
  '1 Timothy': '1TI',
  '2 Timothy': '2TI',
  Titus: 'TIT',
  Philemon: 'PHM',
  Hebrews: 'HEB',
  James: 'JAS',
  '1 Peter': '1PE',
  '2 Peter': '2PE',
  '1 John': '1JN',
  '2 John': '2JN',
  '3 John': '3JN',
  Jude: 'JUD',
  Revelation: 'REV',
};

// ─── Reference parser ────────────────────────────────────────────────────────

/**
 * Parse a human-readable verse reference (e.g. "Matthew 19:28") into a DailyVerseRef.
 * Handles verse ranges like "Romans 8:38-39" by taking the first verse.
 * Returns null if the format is unrecognized or book name doesn't match.
 */
export function parseDailyDoseRef(title: string): DailyVerseRef | null {
  // Match: "Book Name Chapter:Verse" with optional range "-Verse"
  const match = /^(.+?)\s+(\d+):(\d+)(?:-\d+)?$/.exec(title.trim());
  if (!match) return null;

  const [, bookName, chapterStr, verseStr] = match;
  const code = BOOK_NAME_TO_CODE[bookName];
  if (!code) return null;

  const chapter = parseInt(chapterStr, 10);
  const verse = parseInt(verseStr, 10);

  return {
    book: code,
    chapter,
    verse,
    displayRef: `${bookName} ${chapter}:${verse}`,
  };
}

// ─── API fetch ───────────────────────────────────────────────────────────────

const API_URL =
  'https://dailydoseofgreek.com/wp-json/wp/v2/posts?per_page=1&orderby=date&order=desc&categories=5';
const FETCH_TIMEOUT_MS = 5000;
const CACHE_KEY_PREFIX = 'daily-dose-';

interface DailyDoseResult {
  verse: DailyVerseRef;
  link: string;
}

function todayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Fetch today's Daily Dose of Greek verse.
 * Returns the parsed verse ref + link to the analysis page, or null on any failure.
 * Results are cached in sessionStorage for the current day.
 */
export async function fetchDailyDoseVerse(): Promise<DailyDoseResult | null> {
  const dateKey = `${CACHE_KEY_PREFIX}${todayDateStr()}`;

  // Check sessionStorage cache
  try {
    const cached = sessionStorage.getItem(dateKey);
    if (cached) return JSON.parse(cached) as DailyDoseResult;
  } catch {
    /* ignore */
  }

  // Fetch from API with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const posts = (await res.json()) as Array<{ title: { rendered: string }; link: string }>;
    if (!posts.length) return null;

    const verse = parseDailyDoseRef(posts[0].title.rendered);
    if (!verse) return null;

    const result: DailyDoseResult = { verse, link: posts[0].link };

    // Cache in sessionStorage
    try {
      sessionStorage.setItem(dateKey, JSON.stringify(result));
    } catch {
      /* ignore */
    }

    return result;
  } catch {
    return null;
  }
}
