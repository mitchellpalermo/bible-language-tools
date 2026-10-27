import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDailyDoseSource,
  cspAllowsDailyDose,
  DAILY_DOSE_ORIGIN,
  dailyDoseApiUrl,
  decodeHtmlEntities,
  parseLessonTitle,
  pickLesson,
} from './daily-dose';
import { todayStr } from './srs';

// The rules are tested here once, over a toy canon. Each app's own
// `dailyDose.test.ts` covers its book names and category against a saved copy
// of its real feed.

const BOOKS = { Genesis: 'GEN', 'Song of Songs': 'SNG', '1 Kings': '1KI', Psalm: 'PSA' };
const toRef = (title: string) => parseLessonTitle(title, BOOKS);

// ─── decodeHtmlEntities ──────────────────────────────────────────────────────

describe('decodeHtmlEntities', () => {
  it('decodes decimal, hex and named entities', () => {
    expect(decodeHtmlEntities('Q&amp;A &#8211; Psalm 23:1 &#x2014; &rsquo;')).toBe(
      'Q&A – Psalm 23:1 — ’',
    );
  });

  it('leaves unknown and out-of-range entities alone', () => {
    expect(decodeHtmlEntities('&bogus; &#0; &#x110000;')).toBe('&bogus; &#0; &#x110000;');
  });
});

// ─── parseLessonTitle ────────────────────────────────────────────────────────

describe('parseLessonTitle', () => {
  it('parses a reference into the book code, chapter, verse and title name', () => {
    expect(toRef('Psalm 18:51')).toEqual({
      book: 'PSA',
      chapter: 18,
      verse: 51,
      bookName: 'Psalm',
    });
  });

  it('parses multi-word and numbered book names', () => {
    expect(toRef('Song of Songs 8:6')?.book).toBe('SNG');
    expect(toRef('1 Kings 18:21')?.book).toBe('1KI');
  });

  it('drops a partial-verse letter', () => {
    expect(toRef('Genesis 1:1b')).toMatchObject({ chapter: 1, verse: 1 });
  });

  it('takes the first verse of a range, across a chapter or not', () => {
    expect(toRef('Genesis 1:1-2')).toMatchObject({ chapter: 1, verse: 1 });
    expect(toRef('Genesis 1:31 &#8211; 2:1')).toMatchObject({ chapter: 1, verse: 31 });
  });

  it('collapses runs of whitespace, including a non-breaking space', () => {
    expect(toRef('  Song&nbsp;of Songs   8:6 ')?.book).toBe('SNG');
  });

  it('rejects a title that only mentions a reference', () => {
    expect(toRef('Q&amp;A &#8211; Psalm 23:1')).toBeNull();
    expect(toRef('Correction: Psalm 23:1')).toBeNull();
  });

  it('rejects a book outside the canon it was given', () => {
    expect(toRef('Matthew 5:3')).toBeNull();
  });

  it('rejects a name that is only a property of every object', () => {
    // A plain `bookNames[name]` lookup would find Object.prototype here.
    expect(toRef('constructor 1:1')).toBeNull();
  });

  it('rejects titles with no chapter and verse', () => {
    expect(toRef('')).toBeNull();
    expect(toRef('Genesis 1')).toBeNull();
    expect(toRef('4c – Inseparable Prepositions')).toBeNull();
  });
});

// ─── pickLesson ──────────────────────────────────────────────────────────────

const post = (title: string, link = 'https://dailydoseofscripture.com/x/') => ({
  title: { rendered: title },
  link,
});

describe('pickLesson', () => {
  it('skips posts that are not lessons and takes the first that is', () => {
    const posts = [post('Q&amp;A &#8211; Psalm 23:1'), post('Psalm 18:51', 'https://d.example/a')];
    expect(pickLesson(posts, toRef)).toEqual({
      verse: { book: 'PSA', chapter: 18, verse: 51, bookName: 'Psalm' },
      link: 'https://d.example/a',
    });
  });

  it('skips a post with no title or a link that is not https', () => {
    const posts = [
      { link: 'https://d.example/a' },
      post('Genesis 1:1', 'http://d.example/b'),
      post('Genesis 1:2', 'not a url'),
      null,
    ];
    expect(pickLesson(posts, toRef)).toBeNull();
  });

  it('returns null for a response that is not a list', () => {
    expect(pickLesson({ code: 'rest_error' }, toRef)).toBeNull();
  });
});

// ─── dailyDoseApiUrl ─────────────────────────────────────────────────────────

describe('dailyDoseApiUrl', () => {
  it('asks one category on dailydoseofscripture.com for several posts, newest first', () => {
    const url = new URL(dailyDoseApiUrl(192));
    expect(url.origin).toBe(DAILY_DOSE_ORIGIN);
    expect(url.searchParams.get('categories')).toBe('192');
    expect(Number(url.searchParams.get('per_page'))).toBeGreaterThan(1);
    expect(url.searchParams.get('order')).toBe('desc');
  });
});

// ─── cspAllowsDailyDose ──────────────────────────────────────────────────────

describe('cspAllowsDailyDose', () => {
  const csp = (policy: string) => `/*\n  Content-Security-Policy: ${policy}\n`;

  it('finds the origin in connect-src', () => {
    expect(
      cspAllowsDailyDose(csp(`default-src 'self'; connect-src 'self' ${DAILY_DOSE_ORIGIN};`)),
    ).toBe(true);
  });

  it('does not count the origin listed only under another directive', () => {
    expect(cspAllowsDailyDose(csp(`img-src ${DAILY_DOSE_ORIGIN}; connect-src 'self';`))).toBe(
      false,
    );
  });

  it('falls back to default-src when there is no connect-src', () => {
    expect(cspAllowsDailyDose(csp("default-src 'self'"))).toBe(false);
  });

  it('reads the policy, not a comment that names the directive', () => {
    // The first draft of this check matched `connect-src` anywhere in the
    // file, and hebrew.tools' own comment about this origin sat above the policy.
    const headers = `/*\n  # ${DAILY_DOSE_ORIGIN} is the API behind /daily (connect-src only).\n  Content-Security-Policy: connect-src 'self';\n`;
    expect(cspAllowsDailyDose(headers)).toBe(false);
  });

  it('allows it when the file sets no policy at all', () => {
    expect(cspAllowsDailyDose('/*\n  X-Frame-Options: DENY\n')).toBe(true);
  });
});

// ─── createDailyDoseSource ───────────────────────────────────────────────────

describe('createDailyDoseSource', () => {
  const source = createDailyDoseSource({
    categoryId: 192,
    toVerse: toRef,
    cacheKeyPrefix: 'test-dose-',
  });
  const cacheKey = () => `test-dose-${todayStr()}`;

  function respondWith(body: unknown) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => body } as Response);
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('exposes the URL it fetches', () => {
    expect(source.apiUrl).toBe(dailyDoseApiUrl(192));
  });

  it('returns the lesson and caches it for the day', async () => {
    const fetchSpy = respondWith([post('Psalm 18:51', 'https://d.example/a')]);
    const outcome = await source.fetchLesson();
    expect(outcome).toMatchObject({ ok: true, link: 'https://d.example/a' });
    expect(fetchSpy).toHaveBeenCalledWith(source.apiUrl, expect.anything());
    expect(JSON.parse(sessionStorage.getItem(cacheKey()) ?? 'null')).toMatchObject({
      link: 'https://d.example/a',
    });
  });

  it('serves a cached lesson without fetching', async () => {
    const lesson = { verse: toRef('Genesis 1:1'), link: 'https://d.example/c' };
    sessionStorage.setItem(cacheKey(), JSON.stringify(lesson));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await source.fetchLesson()).toEqual({ ok: true, ...lesson });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches again past a cache entry that is not JSON', async () => {
    sessionStorage.setItem(cacheKey(), '{nope');
    respondWith([post('Genesis 1:1')]);
    expect((await source.fetchLesson()).ok).toBe(true);
  });

  it('still answers when sessionStorage refuses the write', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    respondWith([post('Genesis 1:1')]);
    expect((await source.fetchLesson()).ok).toBe(true);
  });

  it('reports a rejected fetch as a network failure and caches nothing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await source.fetchLesson()).toEqual({ ok: false, reason: 'network' });
    expect(sessionStorage.getItem(cacheKey())).toBeNull();
  });

  it('reports an abort as a timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('aborted', 'AbortError'));
    expect(await source.fetchLesson()).toEqual({ ok: false, reason: 'timeout' });
  });

  it('aborts a request that takes longer than five seconds', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = source.fetchLesson();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ ok: false, reason: 'timeout' });
  });

  it('reports an abort while reading the body as a timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => {
        throw new DOMException('aborted', 'AbortError');
      },
    } as unknown as Response);
    expect(await source.fetchLesson()).toEqual({ ok: false, reason: 'timeout' });
  });

  it('reports a non-200 response as an HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    expect(await source.fetchLesson()).toEqual({ ok: false, reason: 'http_error' });
  });

  it('reports a body that is not JSON as a bad response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Response);
    expect(await source.fetchLesson()).toEqual({ ok: false, reason: 'bad_response' });
  });

  it('reports JSON that is not a post list as a bad response', async () => {
    respondWith({ code: 'rest_no_route' });
    expect(await source.fetchLesson()).toEqual({ ok: false, reason: 'bad_response' });
  });

  it('reports a list with no lesson in it as no verse, and caches nothing', async () => {
    respondWith([post('4c – Inseparable Prepositions')]);
    expect(await source.fetchLesson()).toEqual({ ok: false, reason: 'no_verse' });
    expect(sessionStorage.getItem(cacheKey())).toBeNull();
  });
});
