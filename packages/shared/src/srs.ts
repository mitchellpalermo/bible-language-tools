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
 * The four answers a review can get, named as Anki names them.
 *
 * `/write` has graded on this scale since it shipped; vocabulary flashcards
 * used to send only "right" and "wrong". The gap mattered: `easy` is the only
 * grade that raises the ease factor, so without it a card that fell to the 1.30
 * floor could never climb back, and its intervals grew at 1.3x forever however
 * well the student came to know the word.
 */
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

/** SM-2 quality values for each grade. `< 3` is a lapse, which is SM-2's own rule. */
export const GRADE_QUALITY: Record<ReviewGrade, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

export const REVIEW_GRADES = Object.keys(GRADE_QUALITY) as ReviewGrade[];

/** A grade counts as correct — for streaks and accuracy — exactly when SM-2 calls it a pass. */
export function isPassingGrade(grade: ReviewGrade): boolean {
  return GRADE_QUALITY[grade] >= 3;
}

export function gradeForQuality(quality: number): ReviewGrade {
  if (quality < 3) return 'again';
  if (quality === 3) return 'hard';
  if (quality === 4) return 'good';
  return 'easy';
}

/**
 * How each grade moves the ease factor, in Anki's numbers rather than SM-2's.
 *
 * Textbook SM-2 derives the adjustment from a quality score, which docks 0.54
 * for a failure — nearly three times Anki's penalty — and, because this app
 * only ever sent quality 4 for a pass, never gave any of it back. Ease became a
 * one-way ratchet: a word missed twice in week one sat at 1.42 for the rest of
 * the term no matter how well it was later known.
 *
 * Anki's table is gentler and, crucially, two-directional. These are its
 * defaults: Again -0.20, Hard -0.15, Good unchanged, Easy +0.15.
 */
export const EASE_DELTA: Record<ReviewGrade, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

/** Anki's floor. Ease never falls below this however often a card is missed. */
export const MIN_EASE = 1.3;

/**
 * Interval multipliers for the two grades that do not simply use the ease
 * factor. Anki's defaults: Hard advances the card but barely, and Easy takes
 * the ease factor and stretches it.
 */
export const HARD_MULTIPLIER = 1.2;
export const EASY_BONUS = 1.3;

/**
 * SM-2 scheduling with Anki's ease and interval rules.
 *
 * `quality` stays the parameter because it is SM-2's own interface and every
 * stored card was written through it; `gradeForQuality` maps it onto the four
 * buttons. Pass `GRADE_QUALITY[grade]` rather than a bare number at call sites.
 *
 * DELIBERATELY NOT IMPLEMENTED: Anki's sub-day learning and relearning steps
 * (1m, 10m). `SRSCard.dueDate` and `lastReviewed` are calendar dates, not
 * timestamps — the same limitation the sync merge documents — so a scheduler
 * here cannot express "again in ten minutes". A lapse therefore resets to one
 * day, which is where Anki's relearning steps land a card anyway. Adding steps
 * means changing the card shape and every stored card with it.
 */
export function nextSRS(card: SRSCard, quality: number): SRSCard {
  let { interval, repetition, easeFactor } = card;
  const grade = gradeForQuality(quality);

  if (grade === 'again') {
    interval = 1;
    repetition = 0;
  } else {
    // The first two steps are fixed, so ease cannot stretch a card the student
    // has seen once into a multi-week gap. From the third pass on, the grade
    // chooses the multiplier: Hard creeps, Good uses the ease factor, Easy
    // takes the ease factor and adds Anki's bonus on top.
    if (repetition === 0) interval = 1;
    else if (repetition === 1) interval = 6;
    else {
      const multiplier =
        grade === 'hard'
          ? HARD_MULTIPLIER
          : grade === 'easy'
            ? easeFactor * EASY_BONUS
            : easeFactor;
      // The `interval + 1` floor guarantees a pass always advances the card.
      // It does not fire under today's constants (the smallest case, Hard on a
      // 6-day card, rounds to 7 either way) but rounding makes a stall
      // reachable at small intervals if the multipliers are ever tuned, and a
      // card that answers "correct" without moving looks broken to a student.
      interval = Math.max(interval + 1, Math.round(interval * multiplier));
    }
    repetition++;
  }

  easeFactor = Math.max(MIN_EASE, easeFactor + EASE_DELTA[grade]);

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
