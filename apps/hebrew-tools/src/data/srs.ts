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
} from '@tools/shared/srs';

export type { SRSCard, StudyStats };
export {
  daysFromNow,
  isDue,
  newCard,
  nextSRS,
  normalizeKey,
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
