import { readFileSync } from 'node:fs';
import { cspAllowsDailyDose } from '@tools/shared/daily-dose';
import { todayStr } from '@tools/shared/srs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOKS } from '../../scripts/lib/books.mjs';
import {
  bookNameIndex,
  DAILY_DOSE_API_URL,
  displayBookName,
  fetchDailyDoseVerse,
  HEBREW_CATEGORY_ID,
  parseDailyDoseRef,
  TITLE_ALIASES,
} from './dailyDose';
// The real Hebrew feed on Saturday May 23, 2026, when the newest post was a
// Q&A that names a verse. Saved with the same query fetchDailyDoseVerse sends.
import savedFeed from './fixtures/daily-dose-hebrew-feed-2026-05-23.json';

// The fetch, cache and failure rules are tested once, in
// packages/shared/src/daily-dose.test.ts. This file covers what is Hebrew: the
// category, the book names, and the real feed's titles.

/** `books.json` as the build writes it — its names come from this list. */
const books = BOOKS.map(({ code, name }) => ({ code, name }));

describe('bookNameIndex', () => {
  it('maps every book of the Hebrew Bible, plus the feed’s aliases', () => {
    const index = bookNameIndex(books);
    expect(Object.keys(index)).toHaveLength(39 + Object.keys(TITLE_ALIASES).length);
    expect(index['Song of Songs']).toBe('SNG');
    expect(index['1 Kings']).toBe('1KI');
    expect(index.Psalm).toBe('PSA');
    expect(index.Psalms).toBe('PSA');
  });

  it('every alias names a real book', () => {
    const codes = new Set(books.map((b) => b.code));
    for (const code of Object.values(TITLE_ALIASES)) expect(codes).toContain(code);
  });
});

describe('displayBookName', () => {
  it('cites a single psalm as "Psalm", as the curated list does', () => {
    expect(displayBookName('PSA', books)).toBe('Psalm');
  });

  it('uses the corpus name otherwise, and nothing for an unknown code', () => {
    expect(displayBookName('SNG', books)).toBe('Song of Songs');
    expect(displayBookName('XYZ', books)).toBeUndefined();
  });
});

describe('parseDailyDoseRef', () => {
  it('parses a lesson into a reference the corpus can resolve', () => {
    expect(parseDailyDoseRef('Psalm 18:51', books)).toEqual({
      book: 'PSA',
      chapter: 18,
      verse: 51,
      displayRef: 'Psalm 18:51',
    });
  });

  it('shows a partial-verse lesson as the whole verse', () => {
    expect(parseDailyDoseRef('Nehemiah 5:13b', books)?.displayRef).toBe('Nehemiah 5:13');
  });

  it('shows the app’s book name, not the title’s abbreviation', () => {
    expect(parseDailyDoseRef('Gen 1:1', books)?.displayRef).toBe('Genesis 1:1');
  });

  it('keeps the title’s name for an alias whose book is missing from the index', () => {
    expect(parseDailyDoseRef('Gen 1:1', [])?.displayRef).toBe('Gen 1:1');
  });

  it('rejects the posts in the category that are not verse lessons', () => {
    for (const title of [
      'Q&amp;A &#8211; Psalm 23:1',
      'Correction: Jeremiah 7:4',
      '4c &#8211; Inseparable Prepositions ב ל כ',
      'Join the Malachi Hebrew Reading Course with Adam Howell',
      'Isaiah 9:1 and Hebrew New Testament John 1:1',
      'Matthew 5:3',
    ]) {
      expect(parseDailyDoseRef(title, books)).toBeNull();
    }
  });
});

describe('the saved feed', () => {
  it('parses every verse lesson in it, and nothing else', () => {
    const parsed = savedFeed.map((post) => parseDailyDoseRef(post.title.rendered, books));
    expect(parsed.filter(Boolean)).toHaveLength(8);
    expect(parsed[0]).toBeNull(); // Q&A – Psalm 23:1
  });
});

describe('DAILY_DOSE_API_URL', () => {
  it('asks the Hebrew category', () => {
    expect(new URL(DAILY_DOSE_API_URL).searchParams.get('categories')).toBe(
      String(HEBREW_CATEGORY_ID),
    );
  });
});

// A missing host fails as a bare network error, which looks exactly like a
// quiet fallback. Vitest runs from the app directory.
describe('public/_headers connect-src', () => {
  it('allows the Daily Dose API origin', () => {
    expect(cspAllowsDailyDose(readFileSync('public/_headers', 'utf8'))).toBe(true);
  });
});

describe('fetchDailyDoseVerse', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('skips a Q&A on top of the real feed and returns the latest lesson', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => savedFeed } as Response);

    expect(await fetchDailyDoseVerse(books)).toEqual({
      ok: true,
      verse: { book: 'NEH', chapter: 1, verse: 8, displayRef: 'Nehemiah 1:8' },
      link: 'https://dailydoseofscripture.com/hebrew-nehemiah-1-8/',
    });
    expect(fetchSpy).toHaveBeenCalledWith(DAILY_DOSE_API_URL, expect.anything());
  });

  it('caches under its own key, apart from greek.tools', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => savedFeed,
    } as Response);
    await fetchDailyDoseVerse(books);
    expect(sessionStorage.getItem(`hebrew-daily-dose-${todayStr()}`)).not.toBeNull();
    expect(sessionStorage.getItem(`daily-dose-${todayStr()}`)).toBeNull();
  });
});
