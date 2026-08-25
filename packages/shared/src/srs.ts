// Spaced Repetition System — SM-2 algorithm, pure functions and types.
// Storage is app-specific; each app creates its own persistence layer.

export interface SRSCard {
  key: string;
  interval: number; // days until next review
  repetition: number; // times successfully reviewed in a row
  easeFactor: number; // SM-2 ease factor (min 1.3, starts at 2.5)
  dueDate: string; // YYYY-MM-DD
  lastReviewed: string; // YYYY-MM-DD, empty string if never
}

export interface StudyStats {
  streak: number;
  lastStreakDate: string; // last date the daily threshold was hit
  cardsStudiedToday: number;
  lastStudyDate: string; // YYYY-MM-DD
  totalReviewed: number;
  totalCorrect: number;
}

/** Cards per day required to count as a study day for streak purposes */
export const STREAK_THRESHOLD = 10;

/**
 * Format a date as YYYY-MM-DD in the *local* calendar, not UTC. Study days have
 * to roll over at the student's midnight: toISOString() put the boundary at 6pm
 * for a CST user, so an evening session and the next morning's session landed on
 * the same "day" and the streak silently stalled. Card due dates run through the
 * same helpers, so they shifted with it.
 */
function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export function yesterdayStr(): string {
  return daysFromNow(-1);
}

/**
 * Normalize a vocabulary entry to a single canonical lemma form.
 * Compound entries like 'ὁ, ἡ, τό' become 'ὁ' (the first/primary form).
 * Simple entries pass through unchanged.
 */
export function normalizeKey(entry: string): string {
  const comma = entry.indexOf(', ');
  return comma === -1 ? entry : entry.slice(0, comma);
}

export function newCard(key: string): SRSCard {
  return {
    key,
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    dueDate: todayStr(),
    lastReviewed: '',
  };
}

export function isDue(card: SRSCard): boolean {
  return card.dueDate <= todayStr();
}

/**
 * SM-2 algorithm.
 * quality: 0–5 (4 = correct/easy, 1 = incorrect/hard)
 */
export function nextSRS(card: SRSCard, quality: number): SRSCard {
  let { interval, repetition, easeFactor } = card;

  if (quality < 3) {
    interval = 1;
    repetition = 0;
  } else {
    if (repetition === 0) interval = 1;
    else if (repetition === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetition++;
  }

  const ef = easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  easeFactor = Math.max(1.3, ef);

  return {
    key: card.key,
    interval,
    repetition,
    easeFactor,
    dueDate: daysFromNow(interval),
    lastReviewed: todayStr(),
  };
}

export function recordReview(prev: StudyStats, correct: boolean): StudyStats {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const isNewDay = prev.lastStudyDate !== today;
  const cardsToday = (isNewDay ? 0 : prev.cardsStudiedToday) + 1;

  let { streak, lastStreakDate } = prev;

  if (isNewDay && lastStreakDate !== yesterday && lastStreakDate !== today) {
    streak = 0;
  }

  // Credit the day as soon as the counter crosses the threshold, not only when
  // it lands exactly on it. A sync merge adopts the other device's daily count
  // wholesale, which can step over the line in one jump; the old `===` check
  // then never fired again that day, so no amount of study earned the streak.
  if (cardsToday >= STREAK_THRESHOLD && lastStreakDate !== today) {
    if (lastStreakDate === yesterday || lastStreakDate === '') {
      streak++;
    } else {
      streak = 1;
    }
    lastStreakDate = today;
  }

  return {
    streak,
    lastStreakDate,
    cardsStudiedToday: cardsToday,
    lastStudyDate: today,
    totalReviewed: prev.totalReviewed + 1,
    totalCorrect: prev.totalCorrect + (correct ? 1 : 0),
  };
}

export function emptyStats(): StudyStats {
  return {
    streak: 0,
    lastStreakDate: '',
    cardsStudiedToday: 0,
    lastStudyDate: '',
    totalReviewed: 0,
    totalCorrect: 0,
  };
}

/**
 * Roll a stats record loaded from storage onto the current day: today's card
 * counter starts over, and a streak whose anchor is older than yesterday is
 * broken. Pure, so both apps' storage layers share one definition of decay
 * instead of keeping their own copies in step by hand.
 */
export function applyDailyReset(stats: StudyStats): StudyStats {
  const today = todayStr();
  if (stats.lastStudyDate === today) return stats;

  const streakBroken = stats.lastStreakDate !== yesterdayStr() && stats.lastStreakDate !== today;
  return {
    ...stats,
    cardsStudiedToday: 0,
    streak: streakBroken ? 0 : stats.streak,
  };
}
