// SRS (spaced repetition) persistence for hebrew-tools.
//
// The SM-2 algorithm itself lives in @tools/shared/srs — it's pure and
// language-agnostic, so it isn't duplicated here. This module only adds the
// localStorage load/save layer under the hebrew-tools key namespace, which the
// monorepo README calls out as staying app-specific (each app has its own
// storage keys).

import {
  applyDailyReset,
  daysFromNow,
  emptyStats,
  GRADE_QUALITY,
  gradeForQuality,
  isDue,
  isPassingGrade,
  newCard,
  nextSRS,
  normalizeKey,
  REVIEW_GRADES,
  type ReviewGrade,
  recordReview,
  type SRSCard,
  STREAK_THRESHOLD,
  type StudyStats,
  todayStr,
  yesterdayStr,
} from '@tools/shared/srs';

export type { ReviewGrade, SRSCard, StudyStats };
export {
  daysFromNow,
  GRADE_QUALITY,
  gradeForQuality,
  isDue,
  isPassingGrade,
  newCard,
  nextSRS,
  normalizeKey,
  REVIEW_GRADES,
  recordReview,
  STREAK_THRESHOLD,
  todayStr,
  yesterdayStr,
};

const SRS_KEY = 'hebrew-tools-srs-v1';
const STATS_KEY = 'hebrew-tools-stats-v1';

export function loadSRSStore(): Record<string, SRSCard> {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, SRSCard>;
  } catch {
    return {};
  }
}

export function saveSRSStore(store: Record<string, SRSCard>): void {
  localStorage.setItem(SRS_KEY, JSON.stringify(store));
}

export function loadStats(): StudyStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const stored: StudyStats = { ...emptyStats(), ...(JSON.parse(raw) as Partial<StudyStats>) };
    return applyDailyReset(stored);
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: StudyStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

/**
 * Whether a grade should move the SRS card, given the card has already been
 * reviewed recently enough that this answer is not a spaced recall.
 *
 * A confusable deck presents ד three times in one sitting, and three passing
 * grades in five minutes would stretch the interval as though they were three
 * days apart — SM-2 assumes its reviews are spaced, and here they deliberately
 * are not. The paradigm quiz meets the same thing when a table is tried again,
 * or a verb's forms come round again in the summary table. So a repeat can
 * demote but never promote: a lapse still pulls the schedule in, because
 * getting it wrong on the second look is real information, while getting it
 * right again immediately is not.
 */
export function shouldUpdateCard(alreadyReviewed: boolean, grade: ReviewGrade): boolean {
  return !alreadyReviewed || !isPassingGrade(grade);
}
