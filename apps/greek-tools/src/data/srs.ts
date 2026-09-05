// SRS (spaced repetition) persistence for greek-tools.
//
// The SM-2 algorithm and the streak rules live in @tools/shared/srs — they're
// pure and language-agnostic, so they aren't duplicated here. This module only
// adds the localStorage load/save layer under the greek-tools key namespace,
// plus the v1 → v2 key migration, which stay app-specific.

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

const SRS_KEY_V1 = 'greek-tools-srs-v1';
const SRS_KEY = 'greek-tools-srs-v2';
const STATS_KEY = 'greek-tools-stats-v1';

/**
 * Migrate v1 store (compound keys like 'ὁ, ἡ, τό') to v2 (first-lemma keys like 'ὁ').
 * Runs once on first load after upgrade; v1 data is then removed.
 */
function migrateV1(): Record<string, SRSCard> {
  try {
    const raw = localStorage.getItem(SRS_KEY_V1);
    if (!raw) return {};
    const v1 = JSON.parse(raw) as Record<string, SRSCard>;
    const v2: Record<string, SRSCard> = {};
    for (const [k, card] of Object.entries(v1)) {
      const newKey = normalizeKey(k);
      // Don't overwrite if a v2 entry already exists for this key
      if (!v2[newKey]) v2[newKey] = { ...card, key: newKey };
    }
    localStorage.setItem(SRS_KEY, JSON.stringify(v2));
    localStorage.removeItem(SRS_KEY_V1);
    return v2;
  } catch {
    return {};
  }
}

export function loadSRSStore(): Record<string, SRSCard> {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    if (!raw) {
      // First load after upgrade: check for v1 data to migrate
      return migrateV1();
    }
    return JSON.parse(raw) as Record<string, SRSCard>;
  } catch {
    return {};
  }
}

/**
 * Return the set of lemmas the student has successfully reviewed at least once.
 * Used by the GNT Reader to visually mark known words.
 */
export function getStudiedLemmas(): Set<string> {
  const store = loadSRSStore();
  const studied = new Set<string>();
  for (const [key, card] of Object.entries(store)) {
    if (card.repetition > 0) studied.add(key);
  }
  return studied;
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
