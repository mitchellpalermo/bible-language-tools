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

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
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

  if (cardsToday === STREAK_THRESHOLD) {
    if (lastStreakDate === yesterday || lastStreakDate === '') {
      streak++;
    } else if (lastStreakDate !== today) {
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
