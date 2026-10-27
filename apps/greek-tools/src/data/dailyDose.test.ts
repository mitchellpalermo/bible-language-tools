import { readFileSync } from 'node:fs';
import { todayStr } from '@tools/shared/srs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOK_NAME_TO_CODE,
  DAILY_DOSE_API_URL,
  decodeHtmlEntities,
  fetchDailyDoseVerse,
  parseDailyDoseRef,
  pickDailyDoseLesson,
} from './dailyDose';
// The real Greek feed on Saturday Oct 24, 2026, when the newest post was a
// special edition. Saved with the same query fetchDailyDoseVerse sends.
import savedFeed from './fixtures/daily-dose-greek-feed-2026-10-24.json';

// ─── sessionStorage mock ─────────────────────────────────────────────────────

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();

Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock });

// ─── BOOK_NAME_TO_CODE ──────────────────────────────────────────────────────

describe('BOOK_NAME_TO_CODE', () => {
  it('maps all 27 NT books', () => {
    expect(Object.keys(BOOK_NAME_TO_CODE)).toHaveLength(27);
  });

  it('maps well-known books correctly', () => {
    expect(BOOK_NAME_TO_CODE.Matthew).toBe('MAT');
    expect(BOOK_NAME_TO_CODE.John).toBe('JHN');
    expect(BOOK_NAME_TO_CODE.Romans).toBe('ROM');
    expect(BOOK_NAME_TO_CODE['1 Corinthians']).toBe('1CO');
    expect(BOOK_NAME_TO_CODE.Revelation).toBe('REV');
  });

  it('has unique 3-letter codes', () => {
    const codes = Object.values(BOOK_NAME_TO_CODE);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

// ─── parseDailyDoseRef ───────────────────────────────────────────────────────

describe('parseDailyDoseRef', () => {
  it('parses a simple reference', () => {
    const ref = parseDailyDoseRef('Matthew 19:28');
    expect(ref).toEqual({
      book: 'MAT',
      chapter: 19,
      verse: 28,
      displayRef: 'Matthew 19:28',
    });
  });

  it('parses numbered book names', () => {
    const ref = parseDailyDoseRef('1 Corinthians 15:3');
    expect(ref).toEqual({
      book: '1CO',
      chapter: 15,
      verse: 3,
      displayRef: '1 Corinthians 15:3',
    });
  });

  it('handles verse ranges by taking the first verse', () => {
    const ref = parseDailyDoseRef('Romans 8:38-39');
    expect(ref).toEqual({
      book: 'ROM',
      chapter: 8,
      verse: 38,
      displayRef: 'Romans 8:38',
    });
  });

  it('parses all 27 book names', () => {
    for (const [name, code] of Object.entries(BOOK_NAME_TO_CODE)) {
      const ref = parseDailyDoseRef(`${name} 1:1`);
      expect(ref).not.toBeNull();
      expect(ref?.book).toBe(code);
      expect(ref?.chapter).toBe(1);
      expect(ref?.verse).toBe(1);
    }
  });

  it('returns null for empty string', () => {
    expect(parseDailyDoseRef('')).toBeNull();
  });

  it('returns null for unrecognized book name', () => {
    expect(parseDailyDoseRef('Hezekiah 3:16')).toBeNull();
  });

  it('returns null for missing chapter:verse', () => {
    expect(parseDailyDoseRef('Matthew')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseDailyDoseRef('not a verse reference')).toBeNull();
  });

  it('trims whitespace', () => {
    const ref = parseDailyDoseRef('  John 3:16  ');
    expect(ref).not.toBeNull();
    expect(ref?.book).toBe('JHN');
  });

  // WordPress renders a typed dash in title.rendered as an entity.
  it('decodes an HTML-entity dash in a range', () => {
    expect(parseDailyDoseRef('Romans 8:38&#8211;39')?.displayRef).toBe('Romans 8:38');
  });

  it('accepts en and em dashes, with or without spaces', () => {
    expect(parseDailyDoseRef('Romans 8:38\u201339')?.verse).toBe(38);
    expect(parseDailyDoseRef('Romans 8:38 \u2014 39')?.verse).toBe(38);
  });

  it('takes the first verse of a range that crosses a chapter', () => {
    expect(parseDailyDoseRef('Matthew 22:46\u201323:1')).toEqual({
      book: 'MAT',
      chapter: 22,
      verse: 46,
      displayRef: 'Matthew 22:46',
    });
  });

  it('drops a partial-verse letter', () => {
    expect(parseDailyDoseRef('Matthew 23:13b')?.displayRef).toBe('Matthew 23:13');
    expect(parseDailyDoseRef('Matthew 23:13a-14')?.verse).toBe(13);
  });

  it('matches a book name written with a non-breaking space', () => {
    expect(parseDailyDoseRef('1&nbsp;Corinthians 15:3')?.book).toBe('1CO');
  });

  // The Greek category sits beside Hebrew, Aramaic, Latin and Septuagint
  // lessons on the same site; an Old Testament book is never a GNT verse.
  it('returns null for Old Testament and Septuagint titles', () => {
    expect(parseDailyDoseRef('Genesis 15:2')).toBeNull();
    expect(parseDailyDoseRef('Genesis 15:2 Septuagint')).toBeNull();
    expect(parseDailyDoseRef('Nehemiah 5:16')).toBeNull();
  });

  it('returns null for special editions that mention a reference', () => {
    expect(parseDailyDoseRef('Dr. Stephen Westerholm on Romans 4')).toBeNull();
    expect(parseDailyDoseRef('Revelation 1:14, \u201cWhy \u03b4\u03ad?\u201d')).toBeNull();
  });
});

// ─── decodeHtmlEntities ─────────────────────────────────────────────────────

describe('decodeHtmlEntities', () => {
  it('decodes decimal, hex and named entities', () => {
    expect(decodeHtmlEntities('a&#8211;b&#x2014;c&amp;d&rsquo;')).toBe('a\u2013b\u2014c&d\u2019');
  });

  it('leaves unknown and out-of-range entities alone', () => {
    expect(decodeHtmlEntities('&bogus; &#0; &#x110000;')).toBe('&bogus; &#0; &#x110000;');
  });
});

// ─── pickDailyDoseLesson ────────────────────────────────────────────────────

describe('pickDailyDoseLesson', () => {
  it('skips a special edition at the top of the real feed', () => {
    expect(pickDailyDoseLesson(savedFeed)).toEqual({
      verse: { book: 'MAT', chapter: 23, verse: 15, displayRef: 'Matthew 23:15' },
      link: 'https://dailydoseofscripture.com/matthew-2315/',
    });
  });

  it('returns null when nothing in the feed is a verse lesson', () => {
    const specials = savedFeed.filter((post) => !parseDailyDoseRef(post.title.rendered));
    expect(specials.length).toBeGreaterThan(0);
    expect(pickDailyDoseLesson(specials)).toBeNull();
  });

  it('skips posts that are missing a title or a usable link', () => {
    const lesson = pickDailyDoseLesson([
      null,
      { link: 'https://example.com/a' },
      { title: { rendered: 'John 3:16' }, link: 'javascript:alert(1)' },
      { title: { rendered: 'John 3:17' }, link: 'not a url' },
      { title: { rendered: 'John 3:18' }, link: 'https://example.com/john-3-18/' },
    ]);
    expect(lesson?.verse.displayRef).toBe('John 3:18');
  });

  it('returns null for a response that is not a list', () => {
    expect(pickDailyDoseLesson({ code: 'rest_no_route' })).toBeNull();
  });
});

// ─── CSP ────────────────────────────────────────────────────────────────────

// A host missing from connect-src fails as a bare network error, which the page
// turns into a quiet fallback. Pin it here so a host change cannot ship without
// the CSP change. Vitest runs from the app directory.
describe('public/_headers connect-src', () => {
  it('allows the Daily Dose API origin', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    const connectSrc = /connect-src([^;]*)/.exec(headers)?.[1].trim().split(/\s+/) ?? [];
    expect(connectSrc).toContain(new URL(DAILY_DOSE_API_URL).origin);
  });
});

// ─── fetchDailyDoseVerse ─────────────────────────────────────────────────────

function respondWith(body: unknown): void {
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => body } as Response);
}

describe('fetchDailyDoseVerse', () => {
  const lessonPost = {
    title: { rendered: 'Matthew 19:28' },
    link: 'https://dailydoseofscripture.com/matthew-1928/',
  };
  const lesson = {
    verse: { book: 'MAT', chapter: 19, verse: 28, displayRef: 'Matthew 19:28' },
    link: 'https://dailydoseofscripture.com/matthew-1928/',
  };
  const cacheKey = () => `daily-dose-${todayStr()}`;

  beforeEach(() => {
    sessionStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('asks the Greek category on dailydoseofscripture.com for several posts', async () => {
    respondWith([lessonPost]);
    await fetchDailyDoseVerse();

    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(url.origin).toBe('https://dailydoseofscripture.com');
    expect(url.searchParams.get('categories')).toBe('43');
    expect(Number(url.searchParams.get('per_page'))).toBeGreaterThan(1);
  });

  it('returns verse and link on successful fetch, and caches it', async () => {
    respondWith([lessonPost]);

    expect(await fetchDailyDoseVerse()).toEqual({ ok: true, ...lesson });
    expect(JSON.parse(sessionStorageMock.getItem(cacheKey()) ?? 'null')).toEqual(lesson);
  });

  it('returns the first verse lesson when the newest post is not one', async () => {
    respondWith([
      { title: { rendered: 'Genesis 15:2 Septuagint' }, link: 'https://example.com/lxx/' },
      { title: { rendered: 'Praying in Biblical Greek' }, link: 'https://example.com/pray/' },
      lessonPost,
    ]);

    expect(await fetchDailyDoseVerse()).toEqual({ ok: true, ...lesson });
  });

  it('returns cached result from sessionStorage without fetching', async () => {
    sessionStorageMock.setItem(cacheKey(), JSON.stringify(lesson));

    const fetchSpy = vi.spyOn(global, 'fetch');
    expect(await fetchDailyDoseVerse()).toEqual({ ok: true, ...lesson });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ignores a cache entry that is not JSON', async () => {
    sessionStorageMock.setItem(cacheKey(), '{not json');
    respondWith([lessonPost]);

    expect(await fetchDailyDoseVerse()).toEqual({ ok: true, ...lesson });
  });

  // A CSP block, a CORS refusal and a cross-host redirect all reject the fetch
  // with a plain TypeError.
  it('reports a rejected fetch as a network failure and caches nothing', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await fetchDailyDoseVerse()).toEqual({ ok: false, reason: 'network' });
    expect(sessionStorageMock.length).toBe(0);
  });

  it('reports an abort as a timeout', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    expect(await fetchDailyDoseVerse()).toEqual({ ok: false, reason: 'timeout' });
  });

  it('aborts a request that takes longer than five seconds', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(global, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      );
      const pending = fetchDailyDoseVerse();
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toEqual({ ok: false, reason: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a non-200 response as an HTTP error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response);

    expect(await fetchDailyDoseVerse()).toEqual({ ok: false, reason: 'http_error' });
  });

  it('reports a body that is not JSON as a bad response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response);

    expect(await fetchDailyDoseVerse()).toEqual({ ok: false, reason: 'bad_response' });
  });

  it('reports a JSON body that is not a post list as a bad response', async () => {
    respondWith({ code: 'rest_no_route' });

    expect(await fetchDailyDoseVerse()).toEqual({ ok: false, reason: 'bad_response' });
  });

  it('reports an empty list as no verse', async () => {
    respondWith([]);

    expect(await fetchDailyDoseVerse()).toEqual({ ok: false, reason: 'no_verse' });
  });

  it('reports a list with no verse lesson as no verse, and caches nothing', async () => {
    respondWith([{ title: { rendered: 'Song Mnemonic: Aorist' }, link: 'https://example.com' }]);

    expect(await fetchDailyDoseVerse()).toEqual({ ok: false, reason: 'no_verse' });
    expect(sessionStorageMock.length).toBe(0);
  });
});
