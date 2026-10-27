import { beforeEach, describe, expect, it } from 'vitest';
import { BOOKS } from '../../scripts/lib/books.mjs';
import {
  DAILY_STREAK_KEY,
  DAILY_VERSES,
  getTodayIndex,
  getTodayVerse,
  loadStreakData,
  markReadToday,
} from './dailyVerses';

/**
 * These tests are the half of the verse list that can be checked without the
 * corpus — shape, internal consistency, and the day cycle. Whether a reference
 * actually resolves in the Westminster Leningrad Codex is
 * `scripts/check-daily-verses.mjs`, which needs the 24 MB of gitignored data
 * that CI does not build.
 */

const CODES = new Set(BOOKS.map((b) => b.code));
const SECTION_OF = new Map(BOOKS.map((b) => [b.code, b.section]));

// ─── The list ─────────────────────────────────────────────────────────────────

describe('DAILY_VERSES', () => {
  it('holds between 60 and 90 verses', () => {
    expect(DAILY_VERSES.length).toBeGreaterThanOrEqual(60);
    expect(DAILY_VERSES.length).toBeLessThanOrEqual(90);
  });

  it('names only real Tanakh books', () => {
    for (const v of DAILY_VERSES) expect(CODES).toContain(v.book);
  });

  it('has a positive chapter and verse on every entry', () => {
    for (const v of DAILY_VERSES) {
      expect(Number.isInteger(v.chapter)).toBe(true);
      expect(v.chapter).toBeGreaterThan(0);
      expect(Number.isInteger(v.verse)).toBe(true);
      expect(v.verse).toBeGreaterThan(0);
    }
  });

  it('ends every displayRef with the chapter and verse it actually fetches', () => {
    // The whole failure mode of this file is a reference that points somewhere
    // other than where it reads, so the label and the numbers must agree.
    for (const v of DAILY_VERSES) {
      expect(v.displayRef).toMatch(new RegExp(`\\s${v.chapter}:${v.verse}$`));
    }
  });

  it('lists no verse twice', () => {
    const keys = DAILY_VERSES.map((v) => `${v.book}.${v.chapter}.${v.verse}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('draws on all three divisions of the Tanakh', () => {
    const sections = new Set(DAILY_VERSES.map((v) => SECTION_OF.get(v.book)));
    expect(sections).toEqual(new Set(['torah', 'neviim', 'ketuvim']));
  });

  it('gives each division a real share, not a token entry', () => {
    for (const section of ['torah', 'neviim', 'ketuvim']) {
      const count = DAILY_VERSES.filter((v) => SECTION_OF.get(v.book) === section).length;
      expect(count).toBeGreaterThanOrEqual(15);
    }
  });

  it('includes the passages a first-year course actually turns on', () => {
    const refs = DAILY_VERSES.map((v) => v.displayRef);
    expect(refs).toContain('Genesis 1:1');
    expect(refs).toContain('Deuteronomy 6:4');
    expect(refs).toContain('Psalm 23:1');
  });
});

// ─── Versification ────────────────────────────────────────────────────────────

describe('English versification', () => {
  /**
   * Pinned deliberately, rather than merely counted.
   *
   * `english` is the only record that a reference diverges from the English
   * Bible a student reads alongside this, and dropping one is invisible: the
   * verse still loads, and the page simply stops explaining why Isaiah 9:5 is
   * not where their study Bible put it. Each pair below was verified against
   * the corpus's own verse counts.
   */
  const EXPECTED = new Map([
    ['Isaiah 9:5', 'Isaiah 9:6'],
    ['Joel 3:1', 'Joel 2:28'],
    ['Jonah 2:1', 'Jonah 1:17'],
    ['Malachi 3:20', 'Malachi 4:2'],
    ['Psalm 8:2', 'Psalm 8:1'],
    ['Psalm 19:2', 'Psalm 19:1'],
    ['Psalm 19:15', 'Psalm 19:14'],
    ['Psalm 34:9', 'Psalm 34:8'],
    ['Psalm 46:11', 'Psalm 46:10'],
    ['Psalm 51:12', 'Psalm 51:10'],
  ]);

  it('records exactly the divergences that are known to exist', () => {
    const actual = new Map(
      DAILY_VERSES.filter((v) => v.english).map((v) => [v.displayRef, v.english]),
    );
    expect(actual).toEqual(EXPECTED);
  });

  it('never repeats the Hebrew reference as the English one', () => {
    // Present-and-equal claims a divergence that is not there.
    for (const v of DAILY_VERSES) {
      if (v.english !== undefined) expect(v.english).not.toBe(v.displayRef);
    }
  });
});

// ─── Day selection ────────────────────────────────────────────────────────────

describe('getTodayIndex', () => {
  it('stays inside the list', () => {
    const idx = getTodayIndex();
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(DAILY_VERSES.length);
  });

  it('is the same all day', () => {
    const morning = new Date(2026, 7, 14, 6, 0);
    const night = new Date(2026, 7, 14, 23, 30);
    expect(getTodayIndex(morning)).toBe(getTodayIndex(night));
  });

  it('moves on by one the next day', () => {
    const a = getTodayIndex(new Date(2026, 7, 14));
    const b = getTodayIndex(new Date(2026, 7, 15));
    expect((b - a + DAILY_VERSES.length) % DAILY_VERSES.length).toBe(1);
  });
});

describe('getTodayVerse', () => {
  it('returns the entry at today’s index', () => {
    const now = new Date(2026, 7, 14);
    expect(getTodayVerse(now)).toBe(DAILY_VERSES[getTodayIndex(now)]);
  });

  it('reaches every verse in the list across one cycle', () => {
    const seen = new Set(
      Array.from({ length: DAILY_VERSES.length }, (_, i) =>
        getTodayVerse(new Date(2026, 0, 1 + i)),
      ),
    );
    expect(seen.size).toBe(DAILY_VERSES.length);
  });
});

// ─── Streak ───────────────────────────────────────────────────────────────────

describe('streak', () => {
  beforeEach(() => localStorage.clear());

  it('is stored under hebrew.tools’ own key', () => {
    expect(DAILY_STREAK_KEY).toBe('hebrew-tools-daily-v1');
    markReadToday();
    expect(localStorage.getItem(DAILY_STREAK_KEY)).not.toBeNull();
  });

  it('does not read greek.tools’ streak', () => {
    localStorage.setItem(
      'greek-tools-daily-v1',
      JSON.stringify({ streak: 40, lastReadDate: '2026-08-13' }),
    );
    expect(loadStreakData().streak).toBe(0);
  });

  it('does not share the flashcards streak in hebrew-tools-stats-v1', () => {
    markReadToday();
    expect(localStorage.getItem('hebrew-tools-stats-v1')).toBeNull();
  });

  it('counts today once', () => {
    const today = new Date();
    markReadToday(today);
    expect(markReadToday(today).streak).toBe(1);
    expect(loadStreakData().streak).toBe(1);
  });
});
