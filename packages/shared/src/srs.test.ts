import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyDailyReset,
  daysFromNow,
  emptyStats,
  isDue,
  newCard,
  nextSRS,
  normalizeKey,
  recordReview,
  type SRSCard,
  STREAK_THRESHOLD,
  type StudyStats,
  todayStr,
  yesterdayStr,
} from './srs';

// ─── helpers ───────────────────────────────────────────────────────────────

// Local calendar formatting, matching src/srs.ts. Built with toISOString() this
// helper disagreed with the code under test every evening west of UTC.
function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TODAY = dateStr(0);
const YESTERDAY = dateStr(-1);
const TOMORROW = dateStr(1);

function makeCard(overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    key: 'test-key',
    interval: 1,
    repetition: 1,
    easeFactor: 2.5,
    dueDate: TODAY,
    lastReviewed: YESTERDAY,
    ...overrides,
  };
}

// ─── date helpers ────────────────────────────────────────────────────────────

describe('todayStr / daysFromNow / yesterdayStr', () => {
  it('todayStr matches an ISO date (YYYY-MM-DD)', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('daysFromNow(0) equals today', () => {
    expect(daysFromNow(0)).toBe(TODAY);
  });

  it('daysFromNow(1) equals tomorrow', () => {
    expect(daysFromNow(1)).toBe(TOMORROW);
  });

  it('yesterdayStr equals daysFromNow(-1)', () => {
    expect(yesterdayStr()).toBe(YESTERDAY);
  });
});

// ─── normalizeKey ────────────────────────────────────────────────────────────

describe('normalizeKey', () => {
  it('passes through a simple entry unchanged', () => {
    expect(normalizeKey('καί')).toBe('καί');
  });

  it('takes the first form of a compound comma-separated entry', () => {
    expect(normalizeKey('ὁ, ἡ, τό')).toBe('ὁ');
  });
});

// ─── newCard ───────────────────────────────────────────────────────────────

describe('newCard', () => {
  it('creates a card with the given key', () => {
    const card = newCard('כֹּל');
    expect(card.key).toBe('כֹּל');
  });

  it('starts with zero interval and repetition', () => {
    const card = newCard('test');
    expect(card.interval).toBe(0);
    expect(card.repetition).toBe(0);
  });

  it('starts with ease factor of 2.5', () => {
    const card = newCard('test');
    expect(card.easeFactor).toBe(2.5);
  });

  it('sets dueDate to today', () => {
    const card = newCard('test');
    expect(card.dueDate).toBe(TODAY);
  });

  it('starts with empty lastReviewed', () => {
    const card = newCard('test');
    expect(card.lastReviewed).toBe('');
  });
});

// ─── isDue ─────────────────────────────────────────────────────────────────

describe('isDue', () => {
  it('returns true when dueDate is today', () => {
    expect(isDue(makeCard({ dueDate: TODAY }))).toBe(true);
  });

  it('returns true when dueDate is in the past', () => {
    expect(isDue(makeCard({ dueDate: YESTERDAY }))).toBe(true);
  });

  it('returns false when dueDate is in the future', () => {
    expect(isDue(makeCard({ dueDate: TOMORROW }))).toBe(false);
  });
});

// ─── nextSRS ───────────────────────────────────────────────────────────────

describe('nextSRS', () => {
  describe('when quality < 3 (failed)', () => {
    it('resets repetition to 0', () => {
      const card = makeCard({ repetition: 3, interval: 12 });
      const result = nextSRS(card, 2);
      expect(result.repetition).toBe(0);
    });

    it('sets interval to 1', () => {
      const card = makeCard({ repetition: 3, interval: 12 });
      const result = nextSRS(card, 2);
      expect(result.interval).toBe(1);
    });

    it('sets dueDate to tomorrow', () => {
      const card = makeCard({ repetition: 1 });
      const result = nextSRS(card, 1);
      expect(result.dueDate).toBe(TOMORROW);
    });

    it('reduces ease factor on failure (quality 0)', () => {
      const card = makeCard({ easeFactor: 2.5 });
      const result = nextSRS(card, 0);
      expect(result.easeFactor).toBeLessThan(2.5);
    });

    it('never drops ease factor below 1.3', () => {
      const card = makeCard({ easeFactor: 1.3 });
      const result = nextSRS(card, 0);
      expect(result.easeFactor).toBe(1.3);
    });
  });

  describe('when quality >= 3 (passed)', () => {
    it('sets interval to 1 on first successful review (repetition 0)', () => {
      const card = makeCard({ repetition: 0, interval: 0 });
      const result = nextSRS(card, 4);
      expect(result.interval).toBe(1);
      expect(result.repetition).toBe(1);
    });

    it('sets interval to 6 on second successful review (repetition 1)', () => {
      const card = makeCard({ repetition: 1, interval: 1 });
      const result = nextSRS(card, 4);
      expect(result.interval).toBe(6);
      expect(result.repetition).toBe(2);
    });

    it('multiplies interval by ease factor on subsequent reviews', () => {
      const card = makeCard({ repetition: 2, interval: 6, easeFactor: 2.5 });
      const result = nextSRS(card, 4);
      expect(result.interval).toBe(Math.round(6 * 2.5));
    });

    it('increments repetition on success', () => {
      const card = makeCard({ repetition: 2 });
      const result = nextSRS(card, 5);
      expect(result.repetition).toBe(3);
    });

    it('increases ease factor on easy answer (quality 5)', () => {
      const card = makeCard({ easeFactor: 2.5 });
      const result = nextSRS(card, 5);
      expect(result.easeFactor).toBeGreaterThan(2.5);
    });

    it('preserves ease factor on perfect answer (quality 4)', () => {
      const card = makeCard({ easeFactor: 2.5 });
      const result = nextSRS(card, 4);
      // EF change for quality=4: +0.1 - 1*0.08 - 1*0.02 = 0
      expect(result.easeFactor).toBeCloseTo(2.5);
    });

    it('sets lastReviewed to today', () => {
      const card = makeCard({ lastReviewed: YESTERDAY });
      const result = nextSRS(card, 4);
      expect(result.lastReviewed).toBe(TODAY);
    });

    it('preserves the card key', () => {
      const card = makeCard({ key: 'אָמַר' });
      const result = nextSRS(card, 4);
      expect(result.key).toBe('אָמַר');
    });
  });
});

// ─── recordReview ──────────────────────────────────────────────────────────

describe('recordReview', () => {
  it('increments totalReviewed on each call', () => {
    const prev = emptyStats();
    const result = recordReview(prev, true);
    expect(result.totalReviewed).toBe(1);
  });

  it('increments totalCorrect for correct answers', () => {
    const prev = emptyStats();
    const result = recordReview(prev, true);
    expect(result.totalCorrect).toBe(1);
  });

  it('does not increment totalCorrect for incorrect answers', () => {
    const prev = emptyStats();
    const result = recordReview(prev, false);
    expect(result.totalCorrect).toBe(0);
  });

  it('sets lastStudyDate to today', () => {
    const result = recordReview(emptyStats(), true);
    expect(result.lastStudyDate).toBe(TODAY);
  });

  it('increments cardsStudiedToday on the same day', () => {
    const prev: StudyStats = {
      ...emptyStats(),
      lastStudyDate: TODAY,
      cardsStudiedToday: 5,
    };
    const result = recordReview(prev, true);
    expect(result.cardsStudiedToday).toBe(6);
  });

  it('resets cardsStudiedToday to 1 on a new day', () => {
    const prev: StudyStats = {
      ...emptyStats(),
      lastStudyDate: YESTERDAY,
      cardsStudiedToday: 15,
    };
    const result = recordReview(prev, true);
    expect(result.cardsStudiedToday).toBe(1);
  });

  describe('streak logic', () => {
    it('increments streak when daily threshold is first reached today (continuing streak)', () => {
      const prev: StudyStats = {
        streak: 3,
        lastStreakDate: YESTERDAY,
        cardsStudiedToday: STREAK_THRESHOLD - 1,
        lastStudyDate: TODAY,
        totalReviewed: 9,
        totalCorrect: 9,
      };
      const result = recordReview(prev, true);
      expect(result.streak).toBe(4);
      expect(result.lastStreakDate).toBe(TODAY);
    });

    it('does not increment streak again after threshold already hit today', () => {
      const prev: StudyStats = {
        streak: 4,
        lastStreakDate: TODAY,
        cardsStudiedToday: STREAK_THRESHOLD,
        lastStudyDate: TODAY,
        totalReviewed: 10,
        totalCorrect: 10,
      };
      const result = recordReview(prev, true);
      expect(result.streak).toBe(4);
    });

    it('resets streak to 1 when threshold is hit but streak was previously broken', () => {
      const twoDaysAgo = dateStr(-2);
      const prev: StudyStats = {
        streak: 5,
        lastStreakDate: twoDaysAgo,
        cardsStudiedToday: STREAK_THRESHOLD - 1,
        lastStudyDate: TODAY,
        totalReviewed: 9,
        totalCorrect: 9,
      };
      const result = recordReview(prev, true);
      expect(result.streak).toBe(1);
    });

    it('starts streak at 1 on first-ever session when threshold is hit', () => {
      const prev: StudyStats = {
        ...emptyStats(),
        cardsStudiedToday: STREAK_THRESHOLD - 1,
        lastStudyDate: TODAY,
        totalReviewed: 9,
        totalCorrect: 9,
      };
      const result = recordReview(prev, true);
      expect(result.streak).toBe(1);
    });

    it('breaks streak on first review of a new day (missed yesterday)', () => {
      const twoDaysAgo = dateStr(-2);
      const prev: StudyStats = {
        streak: 5,
        lastStreakDate: twoDaysAgo,
        cardsStudiedToday: 15,
        lastStudyDate: twoDaysAgo,
        totalReviewed: 50,
        totalCorrect: 45,
      };
      const result = recordReview(prev, true);
      expect(result.streak).toBe(0);
    });
  });
});

// ─── STREAK_THRESHOLD constant ─────────────────────────────────────────────

describe('STREAK_THRESHOLD', () => {
  it('is a positive number', () => {
    expect(STREAK_THRESHOLD).toBeGreaterThan(0);
  });
});

// ─── regressions: streak credit and the day boundary ────────────────────────

describe('recordReview — crossing the streak threshold (regression)', () => {
  it('credits the day when the counter jumps past the threshold in one step', () => {
    // A sync merge adopts the other device's daily count, so cardsStudiedToday
    // can step over the line rather than landing on it. The old `=== THRESHOLD`
    // check missed that jump and never credited the day again.
    const prev: StudyStats = {
      streak: 3,
      lastStreakDate: YESTERDAY,
      cardsStudiedToday: STREAK_THRESHOLD + 4,
      lastStudyDate: TODAY,
      totalReviewed: 400,
      totalCorrect: 350,
    };
    const result = recordReview(prev, true);
    expect(result.lastStreakDate).toBe(TODAY);
    expect(result.streak).toBe(4);
  });

  it('still earns the day after a merge left a stale anchor and a count past the line', () => {
    let stats: StudyStats = {
      ...emptyStats(),
      cardsStudiedToday: STREAK_THRESHOLD + 5,
      lastStudyDate: TODAY,
      totalReviewed: 400,
      totalCorrect: 350,
    };
    stats = recordReview(stats, true);
    expect(stats.lastStreakDate).toBe(TODAY);
    expect(stats.streak).toBe(1);
  });

  it('credits the day exactly once no matter how many more cards follow', () => {
    let stats: StudyStats = {
      ...emptyStats(),
      streak: 2,
      lastStreakDate: YESTERDAY,
      lastStudyDate: TODAY,
      cardsStudiedToday: STREAK_THRESHOLD - 1,
    };
    for (let i = 0; i < 50; i++) stats = recordReview(stats, true);
    expect(stats.streak).toBe(3);
    expect(stats.lastStreakDate).toBe(TODAY);
  });
});

describe('day boundary is local, not UTC (regression)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('late evening still reports the current local day', () => {
    // West of UTC this instant is already tomorrow in UTC — the old
    // toISOString() helper rolled the study day over at 6pm CST.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 23, 30, 0));
    expect(todayStr()).toBe('2026-05-10');
    expect(yesterdayStr()).toBe('2026-05-09');
  });

  it('just after midnight still reports the current local day', () => {
    // East of UTC this instant is still yesterday in UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 0, 30, 0));
    expect(todayStr()).toBe('2026-05-10');
    expect(daysFromNow(1)).toBe('2026-05-11');
  });

  it('an evening session and the next morning are two different study days', () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date(2026, 4, 10, 19, 0, 0));
    let stats: StudyStats = { ...emptyStats(), lastStudyDate: '2026-05-10', cardsStudiedToday: 9 };
    stats = recordReview(stats, true);
    expect(stats.lastStreakDate).toBe('2026-05-10');
    expect(stats.streak).toBe(1);

    vi.setSystemTime(new Date(2026, 4, 11, 8, 0, 0));
    stats = { ...stats, cardsStudiedToday: STREAK_THRESHOLD - 1, lastStudyDate: '2026-05-11' };
    stats = recordReview(stats, true);
    expect(stats.lastStreakDate).toBe('2026-05-11');
    expect(stats.streak).toBe(2);
  });
});

// ─── applyDailyReset ────────────────────────────────────────────────────────

describe('applyDailyReset', () => {
  it('leaves a record from today untouched', () => {
    const stats: StudyStats = {
      streak: 3,
      lastStreakDate: TODAY,
      cardsStudiedToday: 7,
      lastStudyDate: TODAY,
      totalReviewed: 30,
      totalCorrect: 25,
    };
    expect(applyDailyReset(stats)).toEqual(stats);
  });

  it("clears today's counter on a new day but keeps a streak anchored yesterday", () => {
    const result = applyDailyReset({
      streak: 3,
      lastStreakDate: YESTERDAY,
      cardsStudiedToday: 12,
      lastStudyDate: YESTERDAY,
      totalReviewed: 30,
      totalCorrect: 25,
    });
    expect(result.cardsStudiedToday).toBe(0);
    expect(result.streak).toBe(3);
  });

  it('breaks a streak whose anchor is older than yesterday', () => {
    const result = applyDailyReset({
      streak: 6,
      lastStreakDate: dateStr(-3),
      cardsStudiedToday: 12,
      lastStudyDate: dateStr(-3),
      totalReviewed: 30,
      totalCorrect: 25,
    });
    expect(result.streak).toBe(0);
    expect(result.cardsStudiedToday).toBe(0);
  });

  it('preserves lifetime totals', () => {
    const result = applyDailyReset({
      streak: 1,
      lastStreakDate: dateStr(-5),
      cardsStudiedToday: 12,
      lastStudyDate: dateStr(-5),
      totalReviewed: 300,
      totalCorrect: 250,
    });
    expect(result.totalReviewed).toBe(300);
    expect(result.totalCorrect).toBe(250);
  });
});

describe('emptyStats', () => {
  it('starts with no progress and no streak anchor', () => {
    expect(emptyStats()).toEqual({
      streak: 0,
      lastStreakDate: '',
      cardsStudiedToday: 0,
      lastStudyDate: '',
      totalReviewed: 0,
      totalCorrect: 0,
    });
  });
});
