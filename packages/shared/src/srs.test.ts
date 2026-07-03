import { describe, expect, it } from 'vitest';
import {
  daysFromNow,
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

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
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

function emptyStats(): StudyStats {
  return {
    streak: 0,
    lastStreakDate: '',
    cardsStudiedToday: 0,
    lastStudyDate: '',
    totalReviewed: 0,
    totalCorrect: 0,
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
