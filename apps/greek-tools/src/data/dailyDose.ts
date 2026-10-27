/**
 * greek.tools' binding of the Daily Dose of Scripture feed (#177).
 *
 * Everything that is not Greek — the fetch, the timeout, the cache, entity
 * decoding, skipping special editions — is `@tools/shared/daily-dose`, shared
 * with hebrew.tools. What is left here is the two facts that are greek.tools'
 * own: the Greek category ID and the 27 New Testament book names.
 */

import {
  createDailyDoseSource,
  type DailyDoseLesson as Lesson,
  type DailyDoseOutcome as Outcome,
  parseLessonTitle,
  pickLesson,
} from '@tools/shared/daily-dose';
import type { DailyVerseRef } from './dailyVerses';

export type { DailyDoseFailure } from '@tools/shared/daily-dose';
export { decodeHtmlEntities } from '@tools/shared/daily-dose';

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
 * Parse a Daily Dose lesson title (e.g. "Matthew 19:28") into a DailyVerseRef.
 * Decodes HTML entities first, so a raw `title.rendered` can be passed in.
 * Returns null for anything that is not a single Greek New Testament
 * reference: special editions, interviews, and Old Testament book names.
 */
export function parseDailyDoseRef(title: string): DailyVerseRef | null {
  const ref = parseLessonTitle(title, BOOK_NAME_TO_CODE);
  if (!ref) return null;
  const { book, chapter, verse, bookName } = ref;
  return { book, chapter, verse, displayRef: `${bookName} ${chapter}:${verse}` };
}

// ─── Lesson selection ────────────────────────────────────────────────────────

export type DailyDoseLesson = Lesson<DailyVerseRef>;
export type DailyDoseOutcome = Outcome<DailyVerseRef>;

/**
 * Pick the newest verse lesson from a WordPress posts response (newest first).
 * The Greek category also carries special editions, interviews and event
 * notices, most Saturdays among them, so the newest post is often not a verse.
 */
export function pickDailyDoseLesson(posts: unknown): DailyDoseLesson | null {
  return pickLesson(posts, parseDailyDoseRef);
}

// ─── API fetch ───────────────────────────────────────────────────────────────

/**
 * The "Greek" category on dailydoseofscripture.com, looked up with
 * `/wp-json/wp/v2/categories?slug=greek`. Look it up again rather than
 * guessing if this ever moves: on this host, category 5 (the old Greek ID on
 * dailydoseofgreek.com) is Aramaic.
 */
const GREEK_CATEGORY_ID = 43;

const source = createDailyDoseSource({
  categoryId: GREEK_CATEGORY_ID,
  toVerse: parseDailyDoseRef,
  cacheKeyPrefix: 'daily-dose-',
});

export const DAILY_DOSE_API_URL = source.apiUrl;

/**
 * Fetch the latest Greek verse lesson from Daily Dose of Scripture. Never
 * throws; see `createDailyDoseSource`.
 */
export const fetchDailyDoseVerse: () => Promise<DailyDoseOutcome> = source.fetchLesson;
