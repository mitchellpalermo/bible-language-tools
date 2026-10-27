/**
 * Today's verse lesson from Daily Dose of Scripture — the part that is the same
 * for every language the site teaches.
 *
 * dailydoseofscripture.com publishes a short video lesson on one verse most
 * weekdays, per language, as WordPress posts whose title is the reference
 * ("Matthew 23:17", "Nehemiah 5:13b"). Both apps read their own category from
 * the public REST API and fall back to a curated verse list when they cannot.
 * What differs between them is two pieces of data — the category ID and the
 * book names a title may use — so each app binds them with
 * `createDailyDoseSource` and keeps everything else here.
 *
 * Things that are true of the feed in every language (checked Oct 2026):
 *
 * - **The newest post is often not a verse.** Special editions, Q&A, course
 *   notices and grammar lessons share each category, most Saturdays among them.
 *   The fetch takes several posts and uses the first title that parses as one
 *   reference in the app's own canon, so a special skips to the latest lesson
 *   rather than failing the day.
 * - **`title.rendered` is HTML.** WordPress writes `&#8211;` for a dash and
 *   `&amp;` for `&`, so a raw title never matches a plain-text pattern.
 * - **A broken feed looks like a normal page**, because the fallback is a real
 *   verse. Every failure therefore comes back with a reason for the app to
 *   report — the Greek feed fell back silently for weeks in #177.
 */

import { cspBlockingDirective } from './csp';
import { todayStr } from './srs';

// ─── Title cleanup ───────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
};

/**
 * Decode the HTML entities WordPress puts in `title.rendered`. Unknown entities
 * are left as they are.
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
 * accepted. Only the first verse is kept. Anchored at both ends, so a title
 * that merely mentions a reference ("Q&A – Psalm 23:1") puts the extra words
 * into the book name, and the book-name lookup rejects it.
 */
const REFERENCE_PATTERN = /^(.+?) (\d+):(\d+)[a-z]?(?: ?[-‐-―] ?(?:\d+:)?\d+[a-z]?)?$/;

export interface LessonRef {
  /** The app's book code — whatever its corpus names its files by. */
  book: string;
  chapter: number;
  verse: number;
  /** The book name exactly as the title wrote it. */
  bookName: string;
}

/**
 * Parse a lesson title into a reference, against one app's book names. Decodes
 * HTML entities first, so a raw `title.rendered` can be passed in. Returns null
 * for anything that is not a single reference to a book in `bookNames`.
 */
export function parseLessonTitle(
  title: string,
  bookNames: Readonly<Record<string, string>>,
): LessonRef | null {
  const clean = decodeHtmlEntities(title).replace(/\s+/g, ' ').trim();
  const match = REFERENCE_PATTERN.exec(clean);
  if (!match) return null;

  const [, bookName, chapterStr, verseStr] = match;
  if (!Object.hasOwn(bookNames, bookName)) return null;

  return {
    book: bookNames[bookName],
    chapter: parseInt(chapterStr, 10),
    verse: parseInt(verseStr, 10),
    bookName,
  };
}

// ─── Lesson selection ────────────────────────────────────────────────────────

export interface DailyDoseLesson<V> {
  verse: V;
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
 * Pick the newest verse lesson from a WordPress posts response (newest first),
 * skipping anything `toVerse` does not accept. Returns null when no post
 * parses, or when the response is not the expected shape.
 */
export function pickLesson<V>(
  posts: unknown,
  toVerse: (title: string) => V | null,
): DailyDoseLesson<V> | null {
  if (!Array.isArray(posts)) return null;
  for (const post of posts) {
    const title = post?.title?.rendered;
    if (typeof title !== 'string' || !isHttpsUrl(post?.link)) continue;
    const verse = toVerse(title);
    if (verse) return { verse, link: post.link };
  }
  return null;
}

// ─── API fetch ───────────────────────────────────────────────────────────────

/** Daily Dose of Greek became Daily Dose of Scripture in October 2026 (#177). */
export const DAILY_DOSE_ORIGIN = 'https://dailydoseofscripture.com';

/** Enough to get past a run of special editions; one is about weekly. */
const POSTS_TO_SCAN = 10;

const FETCH_TIMEOUT_MS = 5000;

/** The posts query for one category, newest first, titles and links only. */
export function dailyDoseApiUrl(categoryId: number): string {
  return `${DAILY_DOSE_ORIGIN}/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${POSTS_TO_SCAN}&orderby=date&order=desc&_fields=title,link`;
}

/**
 * Why the page fell back to its own verse list. Each app reports it with its
 * verse-viewed event, so a broken source shows up in analytics instead of
 * passing silently.
 *
 * `network` covers everything the browser reports as a bare failed fetch:
 * offline, DNS, a CORS refusal, or a host the CSP's connect-src does not list.
 * The browser does not let a page tell those apart.
 */
export type DailyDoseFailure = 'timeout' | 'network' | 'http_error' | 'bad_response' | 'no_verse';

export type DailyDoseOutcome<V> =
  | ({ ok: true } & DailyDoseLesson<V>)
  | { ok: false; reason: DailyDoseFailure };

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function readCache<V>(key: string): DailyDoseLesson<V> | null {
  try {
    const cached = sessionStorage.getItem(key);
    return cached ? (JSON.parse(cached) as DailyDoseLesson<V>) : null;
  } catch {
    return null;
  }
}

function writeCache<V>(key: string, lesson: DailyDoseLesson<V>): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(lesson));
  } catch {
    /* storage full or blocked: the next visit fetches again */
  }
}

export interface DailyDoseSourceOptions<V> {
  /**
   * The language's category on dailydoseofscripture.com. **Look it up; never
   * guess it** (`/wp-json/wp/v2/categories?slug=greek`): the old Greek ID, 5,
   * is Aramaic on the new host.
   */
  categoryId: number;
  /** Turn a raw `title.rendered` into the app's verse type, or reject it. */
  toVerse: (title: string) => V | null;
  /** sessionStorage key prefix; today's local date is appended. */
  cacheKeyPrefix: string;
}

/**
 * One language's Daily Dose feed.
 *
 * `fetchLesson` never throws: every failure comes back as `{ ok: false, reason }`
 * for the caller to fall back on and report. Only successes are cached, in
 * sessionStorage for the current local day, and the timeout covers reading the
 * body as well as the request.
 */
export function createDailyDoseSource<V>({
  categoryId,
  toVerse,
  cacheKeyPrefix,
}: DailyDoseSourceOptions<V>) {
  const apiUrl = dailyDoseApiUrl(categoryId);

  async function fetchLesson(): Promise<DailyDoseOutcome<V>> {
    const cacheKey = `${cacheKeyPrefix}${todayStr()}`;
    const cached = readCache<V>(cacheKey);
    if (cached) return { ok: true, ...cached };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      let res: Response;
      try {
        res = await fetch(apiUrl, { signal: controller.signal });
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

      const lesson = pickLesson(posts, toVerse);
      if (!lesson) return { ok: false, reason: 'no_verse' };

      writeCache(cacheKey, lesson);
      return { ok: true, ...lesson };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { apiUrl, fetchLesson };
}

/**
 * Whether a `_headers` file's Content-Security-Policy lets the page reach the
 * Daily Dose API. A missing host fails as a bare network error — just another
 * quiet fallback — so each app pins this against its real file.
 */
export function cspAllowsDailyDose(headers: string): boolean {
  return cspBlockingDirective(headers, DAILY_DOSE_ORIGIN, ['connect-src']) === null;
}
