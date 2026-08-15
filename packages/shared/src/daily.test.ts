import { beforeEach, describe, expect, it } from 'vitest';
import { createDailyStreak, dayIndex, epochDay, localDateStr } from './daily';

// ─── localStorage mock ────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const KEY = 'test-daily-v1';
const { loadStreakData, markReadToday } = createDailyStreak(KEY);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function setStored(streak: number, lastReadDate: string) {
  localStorageMock.setItem(KEY, JSON.stringify({ streak, lastReadDate }));
}

// ─── epochDay ─────────────────────────────────────────────────────────────────

describe('epochDay', () => {
  it('increases by exactly one per calendar day', () => {
    const d1 = new Date(2026, 0, 1);
    const d2 = new Date(2026, 0, 2);
    expect(epochDay(d2) - epochDay(d1)).toBe(1);
  });

  it('is the same for every moment within a local day', () => {
    const morning = new Date(2026, 4, 17, 0, 0, 1);
    const night = new Date(2026, 4, 17, 23, 59, 59);
    expect(epochDay(morning)).toBe(epochDay(night));
  });

  it('crosses correctly over a month boundary', () => {
    expect(epochDay(new Date(2026, 1, 1)) - epochDay(new Date(2026, 0, 31))).toBe(1);
  });

  it('crosses correctly over a leap day', () => {
    // 2028 is a leap year: Feb 28 → Feb 29 → Mar 1.
    expect(epochDay(new Date(2028, 1, 29)) - epochDay(new Date(2028, 1, 28))).toBe(1);
    expect(epochDay(new Date(2028, 2, 1)) - epochDay(new Date(2028, 1, 29))).toBe(1);
  });
});

// ─── dayIndex ─────────────────────────────────────────────────────────────────

describe('dayIndex', () => {
  it('stays within bounds', () => {
    for (let i = 0; i < 400; i++) {
      const idx = dayIndex(83, new Date(2026, 0, 1 + i));
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(83);
    }
  });

  it('advances by one per day', () => {
    const a = dayIndex(83, new Date(2026, 0, 1));
    const b = dayIndex(83, new Date(2026, 0, 2));
    expect((b - a + 83) % 83).toBe(1);
  });

  it('visits every entry across one full cycle', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 83; i++) seen.add(dayIndex(83, new Date(2026, 0, 1 + i)));
    expect(seen.size).toBe(83);
  });

  it('is deterministic for the same date', () => {
    const d = new Date(2026, 7, 14);
    expect(dayIndex(83, d)).toBe(dayIndex(83, d));
  });

  it('never returns a negative index for dates before 1970', () => {
    // `%` keeps the sign of the dividend in JavaScript, so a pre-epoch date is
    // the case a single modulo gets wrong.
    const idx = dayIndex(83, new Date(1965, 5, 5));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(83);
  });

  it('returns 0 for an empty list rather than NaN', () => {
    expect(dayIndex(0)).toBe(0);
  });
});

// ─── localDateStr ─────────────────────────────────────────────────────────────

describe('localDateStr', () => {
  it('zero-pads month and day', () => {
    expect(localDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('reads the local date, not the UTC one', () => {
    // Late evening local time is already tomorrow in UTC for anyone east of
    // Greenwich and still yesterday for anyone west — `toISOString().slice(0,10)`
    // is what this guards against.
    const late = new Date(2026, 2, 15, 23, 30);
    expect(localDateStr(late)).toBe('2026-03-15');
  });
});

// ─── createDailyStreak ────────────────────────────────────────────────────────

describe('createDailyStreak', () => {
  beforeEach(() => localStorageMock.clear());

  const today = new Date();
  const todayStr = localDateStr(today);

  describe('loadStreakData', () => {
    it('reads zero when nothing is stored', () => {
      expect(loadStreakData()).toEqual({ streak: 0, lastReadDate: '' });
    });

    it('reads back what was stored', () => {
      setStored(5, '2026-06-01');
      expect(loadStreakData()).toEqual({ streak: 5, lastReadDate: '2026-06-01' });
    });

    it('reads zero on malformed JSON', () => {
      localStorageMock.setItem(KEY, 'not-json');
      expect(loadStreakData().streak).toBe(0);
    });

    it('reads zero when the stored shape is wrong', () => {
      localStorageMock.setItem(KEY, JSON.stringify({ streak: 'lots', lastReadDate: 1 }));
      expect(loadStreakData()).toEqual({ streak: 0, lastReadDate: '' });
    });

    it('reads zero when the stored value is not an object', () => {
      localStorageMock.setItem(KEY, JSON.stringify(null));
      expect(loadStreakData()).toEqual({ streak: 0, lastReadDate: '' });
    });
  });

  describe('markReadToday', () => {
    it('starts a streak of 1 on the first read', () => {
      expect(markReadToday(today)).toEqual({ streak: 1, lastReadDate: todayStr });
    });

    it('is idempotent within one calendar day', () => {
      markReadToday(today);
      markReadToday(today);
      expect(markReadToday(today).streak).toBe(1);
    });

    it('increments on consecutive days', () => {
      setStored(3, localDateStr(daysAgo(1)));
      expect(markReadToday(today).streak).toBe(4);
    });

    it('restarts at 1 — not 0 — when a day was missed', () => {
      setStored(7, localDateStr(daysAgo(2)));
      expect(markReadToday(today).streak).toBe(1);
    });

    it('persists the updated streak', () => {
      markReadToday(today);
      expect(JSON.parse(localStorageMock.getItem(KEY)!)).toEqual({
        streak: 1,
        lastReadDate: todayStr,
      });
    });

    it('increments across a month boundary', () => {
      const mar1 = new Date(2026, 2, 1);
      setStored(9, localDateStr(new Date(2026, 1, 28)));
      expect(markReadToday(mar1).streak).toBe(10);
    });

    it('keeps each storage key on its own streak', () => {
      const other = createDailyStreak('other-daily-v1');
      markReadToday(today);
      expect(other.loadStreakData().streak).toBe(0);
      expect(loadStreakData().streak).toBe(1);
    });
  });
});
