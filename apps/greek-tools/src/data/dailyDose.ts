import { todayStr } from '@tools/shared/srs';
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

// ─── Title cleanup ───────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
};

/**
 * Decode the HTML entities WordPress puts in `title.rendered`. It writes a
 * typed dash as `&#8211;` and `&` as `&amp;`, so a raw title never matches a
 * plain-text pattern. Unknown entities are left as they are.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

// ─── Reference parser ────────────────────────────────────────────────────────

/**
 * "Book C:V", optionally with a partial-verse letter ("23:13b") and a range
 * ("8:38-39", "8:38–39", "22:46–23:1"). Any dash from hyphen to em dash is
 * accepted. Only the first verse is kept.
 */
const REFERENCE_PATTERN = /^(.+?) (\d+):(\d+)[a-z]?(?: ?[-‐-―] ?(?:\d+:)?\d+[a-z]?)?$/;

/**
 * Parse a Daily Dose lesson title (e.g. "Matthew 19:28") into a DailyVerseRef.
 * Decodes HTML entities first, so a raw `title.rendered` can be passed in.
 * Returns null for anything that is not a single Greek New Testament
 * reference: special editions, interviews, and Old Testament book names.
 */
export function parseDailyDoseRef(title: string): DailyVerseRef | null {
  const clean = decodeHtmlEntities(title).replace(/\s+/g, ' ').trim();
  const match = REFERENCE_PATTERN.exec(clean);
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

// ─── Lesson selection ────────────────────────────────────────────────────────

export interface DailyDoseLesson {
  verse: DailyVerseRef;
  link: string;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Pick the newest verse lesson from a WordPress posts response (newest first).
 * The Greek category also carries special editions, interviews and event
 * notices, most Saturdays among them, so the newest post is often not a verse.
 * Those are skipped rather than failing the day. Returns null when no post
 * parses, or when the response is not the expected shape.
 */
export function pickDailyDoseLesson(posts: unknown): DailyDoseLesson | null {
  if (!Array.isArray(posts)) return null;
  for (const post of posts) {
    const title = post?.title?.rendered;
    if (typeof title !== 'string' || !isHttpsUrl(post?.link)) continue;
    const verse = parseDailyDoseRef(title);
    if (verse) return { verse, link: post.link };
  }
  return null;
}

// ─── API fetch ───────────────────────────────────────────────────────────────

/**
 * Daily Dose of Greek became Daily Dose of Scripture in October 2026 (#177).
 * The old domain still answers, but its Greek posts stopped on Oct 2.
 */
const DAILY_DOSE_ORIGIN = 'https://dailydoseofscripture.com';

/**
 * The "Greek" category on dailydoseofscripture.com, looked up with
 * `/wp-json/wp/v2/categories?slug=greek`. Look it up again rather than
 * guessing if this ever moves: on this host, category 5 (the old Greek ID on
 * dailydoseofgreek.com) is Aramaic.
 */
const GREEK_CATEGORY_ID = 43;

/** Enough to get past a run of special editions; one is about weekly. */
const POSTS_TO_SCAN = 10;

export const DAILY_DOSE_API_URL = `${DAILY_DOSE_ORIGIN}/wp-json/wp/v2/posts?categories=${GREEK_CATEGORY_ID}&per_page=${POSTS_TO_SCAN}&orderby=date&order=desc&_fields=title,link`;

const FETCH_TIMEOUT_MS = 5000;
const CACHE_KEY_PREFIX = 'daily-dose-';

/**
 * Why the page fell back to its own verse list. Reported to PostHog with
 * `daily_verse_viewed`, so a broken source shows up in analytics instead of
 * passing silently.
 *
 * `network` covers everything the browser reports as a bare failed fetch:
 * offline, DNS, a CORS refusal, or a host the CSP's connect-src does not list.
 * The browser does not let a page tell those apart.
 */
export type DailyDoseFailure = 'timeout' | 'network' | 'http_error' | 'bad_response' | 'no_verse';

export type DailyDoseOutcome =
  | ({ ok: true } & DailyDoseLesson)
  | { ok: false; reason: DailyDoseFailure };

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function readCache(key: string): DailyDoseLesson | null {
  try {
    const cached = sessionStorage.getItem(key);
    return cached ? (JSON.parse(cached) as DailyDoseLesson) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, lesson: DailyDoseLesson): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(lesson));
  } catch {
    /* storage full or blocked: the next visit fetches again */
  }
}

/**
 * Fetch the latest Greek verse lesson from Daily Dose of Scripture.
 * Never throws: every failure comes back as `{ ok: false, reason }` for the
 * caller to fall back on and report. Only successes are cached, in
 * sessionStorage for the current local day.
 */
export async function fetchDailyDoseVerse(): Promise<DailyDoseOutcome> {
  const cacheKey = `${CACHE_KEY_PREFIX}${todayStr()}`;
  const cached = readCache(cacheKey);
  if (cached) return { ok: true, ...cached };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(DAILY_DOSE_API_URL, { signal: controller.signal });
    } catch (err) {
      return { ok: false, reason: isAbort(err) ? 'timeout' : 'network' };
    }
    if (!res.ok) return { ok: false, reason: 'http_error' };

    let posts: unknown;
    try {
      posts = await res.json();
    } catch (err) {
      return { ok: false, reason: isAbort(err) ? 'timeout' : 'bad_response' };
    }
    if (!Array.isArray(posts)) return { ok: false, reason: 'bad_response' };

    const lesson = pickDailyDoseLesson(posts);
    if (!lesson) return { ok: false, reason: 'no_verse' };

    writeCache(cacheKey, lesson);
    return { ok: true, ...lesson };
  } finally {
    clearTimeout(timeoutId);
  }
}
