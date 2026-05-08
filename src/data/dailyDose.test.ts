import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOK_NAME_TO_CODE, fetchDailyDoseVerse, parseDailyDoseRef } from './dailyDose';

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
});

// ─── fetchDailyDoseVerse ─────────────────────────────────────────────────────

describe('fetchDailyDoseVerse', () => {
  const mockPost = {
    title: { rendered: 'Matthew 19:28' },
    link: 'https://dailydoseofgreek.com/scripture-passage/matthew-19-28/',
  };

  beforeEach(() => {
    sessionStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('returns verse and link on successful fetch', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockPost],
    } as Response);

    const result = await fetchDailyDoseVerse();
    expect(result).toEqual({
      verse: {
        book: 'MAT',
        chapter: 19,
        verse: 28,
        displayRef: 'Matthew 19:28',
      },
      link: 'https://dailydoseofgreek.com/scripture-passage/matthew-19-28/',
    });
  });

  it('returns cached result from sessionStorage without fetching', async () => {
    // Pre-seed sessionStorage with a cached result
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateKey = `daily-dose-${y}-${m}-${d}`;
    const cached = {
      verse: { book: 'MAT', chapter: 19, verse: 28, displayRef: 'Matthew 19:28' },
      link: 'https://dailydoseofgreek.com/scripture-passage/matthew-19-28/',
    };
    sessionStorageMock.setItem(dateKey, JSON.stringify(cached));

    const fetchSpy = vi.spyOn(global, 'fetch');
    const result = await fetchDailyDoseVerse();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual(cached);
  });

  it('returns null on network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await fetchDailyDoseVerse();
    expect(result).toBeNull();
  });

  it('returns null on non-200 response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const result = await fetchDailyDoseVerse();
    expect(result).toBeNull();
  });

  it('returns null when response has no posts', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await fetchDailyDoseVerse();
    expect(result).toBeNull();
  });

  it('returns null when title is unparseable', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        { title: { rendered: 'Song Mnemonic: Aorist' }, link: 'https://example.com' },
      ],
    } as Response);

    const result = await fetchDailyDoseVerse();
    expect(result).toBeNull();
  });

  it('returns null on abort/timeout', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const result = await fetchDailyDoseVerse();
    expect(result).toBeNull();
  });
});
