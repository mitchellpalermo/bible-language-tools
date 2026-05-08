import { beforeEach, describe, expect, it } from 'vitest';
import {
  DAILY_VERSES,
  type DailyStreakData,
  getTodayIndex,
  getTodayVerse,
  loadStreakData,
  markReadToday,
} from './dailyVerses';

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageMock = (() => {
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
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// ─── helpers ──────────────────────────────────────────────────────────────────

function dateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function setStoredStreak(streak: number, lastReadDate: string) {
  const data: DailyStreakData = { streak, lastReadDate };
  localStorageMock.setItem('greek-tools-daily-v1', JSON.stringify(data));
}

// ─── DAILY_VERSES ─────────────────────────────────────────────────────────────

describe('DAILY_VERSES', () => {
  it('has at least 30 entries', () => {
    expect(DAILY_VERSES.length).toBeGreaterThanOrEqual(30);
  });

  it('every entry has all required fields', () => {
    for (const v of DAILY_VERSES) {
      expect(typeof v.book).toBe('string');
      expect(v.book.length).toBeGreaterThan(0);
      expect(v.chapter).toBeGreaterThan(0);
      expect(v.verse).toBeGreaterThan(0);
      expect(typeof v.displayRef).toBe('string');
      expect(v.displayRef.length).toBeGreaterThan(0);
    }
  });

  it('contains well-known passages', () => {
    const refs = DAILY_VERSES.map((v) => v.displayRef);
    expect(refs).toContain('John 3:16');
    expect(refs).toContain('Romans 3:23');
    expect(refs).toContain('Philippians 4:13');
  });
});

// ─── getTodayIndex ────────────────────────────────────────────────────────────

describe('getTodayIndex', () => {
  it('returns a value within DAILY_VERSES bounds', () => {
    const idx = getTodayIndex();
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(DAILY_VERSES.length);
  });

  it('is deterministic for the same date', () => {
    const d = new Date(2025, 0, 1); // Jan 1 2025
    expect(getTodayIndex(d)).toBe(getTodayIndex(d));
  });

  it('differs between consecutive days', () => {
    const d1 = new Date(2025, 0, 1);
    const d2 = new Date(2025, 0, 2);
    // Not guaranteed to differ (could wrap) but across the list length this
    // effectively always holds for adjacent days
    const i1 = getTodayIndex(d1);
    const i2 = getTodayIndex(d2);
    expect(Math.abs(i1 - i2)).toBe(1);
  });

  it('wraps around the verse list length', () => {
    // Use a date whose epoch-day is exactly a multiple of DAILY_VERSES.length
    const epoch = new Date(0); // midnight UTC Jan 1 1970 (epochDays = 0)
    // epochDays = 0 → index = 0 (or wraps to 0)
    const idx = getTodayIndex(epoch);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(DAILY_VERSES.length);
  });
});

// ─── getTodayVerse ────────────────────────────────────────────────────────────

describe('getTodayVerse', () => {
  it('returns a valid verse ref', () => {
    const v = getTodayVerse();
    expect(v).toBeDefined();
    expect(v.book).toBeTruthy();
    expect(v.displayRef).toBeTruthy();
  });

  it('returns the verse at getTodayIndex', () => {
    const now = new Date();
    expect(getTodayVerse(now)).toBe(DAILY_VERSES[getTodayIndex(now)]);
  });
});

// ─── loadStreakData ───────────────────────────────────────────────────────────

describe('loadStreakData', () => {
  beforeEach(() => localStorageMock.clear());

  it('returns zero streak when storage is empty', () => {
    const data = loadStreakData();
    expect(data.streak).toBe(0);
    expect(data.lastReadDate).toBe('');
  });

  it('returns stored streak data', () => {
    setStoredStreak(5, '2025-06-01');
    const data = loadStreakData();
    expect(data.streak).toBe(5);
    expect(data.lastReadDate).toBe('2025-06-01');
  });

  it('returns zero streak on malformed JSON', () => {
    localStorageMock.setItem('greek-tools-daily-v1', 'not-json');
    const data = loadStreakData();
    expect(data.streak).toBe(0);
  });
});

// ─── markReadToday ────────────────────────────────────────────────────────────

describe('markReadToday', () => {
  beforeEach(() => localStorageMock.clear());

  const today = new Date();
  const todayStr = dateStr(today);

  it('starts a streak of 1 on first ever read', () => {
    const data = markReadToday(today);
    expect(data.streak).toBe(1);
    expect(data.lastReadDate).toBe(todayStr);
  });

  it('is idempotent when called multiple times on the same day', () => {
    markReadToday(today);
    markReadToday(today);
    const data = markReadToday(today);
    expect(data.streak).toBe(1);
    expect(data.lastReadDate).toBe(todayStr);
  });

  it('increments streak when read on consecutive days', () => {
    setStoredStreak(3, dateStr(daysAgo(1)));
    const data = markReadToday(today);
    expect(data.streak).toBe(4);
    expect(data.lastReadDate).toBe(todayStr);
  });

  it('resets streak to 1 when a day is missed', () => {
    setStoredStreak(7, dateStr(daysAgo(2)));
    const data = markReadToday(today);
    expect(data.streak).toBe(1);
  });

  it('persists updated streak to localStorage', () => {
    markReadToday(today);
    const stored = JSON.parse(localStorageMock.getItem('greek-tools-daily-v1')!) as DailyStreakData;
    expect(stored.streak).toBe(1);
    expect(stored.lastReadDate).toBe(todayStr);
  });
});
