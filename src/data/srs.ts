// Spaced Repetition System (SM-2 algorithm) with localStorage persistence

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

const SRS_KEY_V1 = 'greek-tools-srs-v1';
const SRS_KEY = 'greek-tools-srs-v2';
const STATS_KEY = 'greek-tools-stats-v1';

/**
 * Normalize a vocabulary entry's greek field to a single canonical lemma form.
 * Compound entries like 'ὁ, ἡ, τό' become 'ὁ' (the first/primary form).
 * Simple entries like 'καί' pass through unchanged.
 * This key is used in the SRS store so lemmas match MorphGNT format.
 */
export function normalizeKey(greek: string): string {
  const comma = greek.indexOf(', ');
  return comma === -1 ? greek : greek.slice(0, comma);
}

/** Cards per day required to count as a study day for streak purposes */
export const STREAK_THRESHOLD = 10;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  return daysFromNow(-1);
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
    // Failed — reset repetition count, review again tomorrow
    interval = 1;
    repetition = 0;
  } else {
    // Passed — calculate new interval per SM-2
    if (repetition === 0) interval = 1;
    else if (repetition === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetition++;
  }

  // Update ease factor (bounded at 1.3 minimum)
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

const emptyStats = (): StudyStats => ({
  streak: 0,
  lastStreakDate: '',
  cardsStudiedToday: 0,
  lastStudyDate: '',
  totalReviewed: 0,
  totalCorrect: 0,
});

export function loadStats(): StudyStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const s: StudyStats = { ...emptyStats(), ...(JSON.parse(raw) as Partial<StudyStats>) };

    // Reset daily count when it's a new day
    if (s.lastStudyDate !== todayStr()) {
      s.cardsStudiedToday = 0;
      // If the user missed a day, their streak is broken
      if (s.lastStreakDate !== yesterdayStr() && s.lastStreakDate !== todayStr()) {
        s.streak = 0;
      }
    }
    return s;
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: StudyStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordReview(prev: StudyStats, correct: boolean): StudyStats {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const isNewDay = prev.lastStudyDate !== today;
  const cardsToday = (isNewDay ? 0 : prev.cardsStudiedToday) + 1;

  let { streak, lastStreakDate } = prev;

  // Detect streak break on the first review of a new day
  if (isNewDay && lastStreakDate !== yesterday && lastStreakDate !== today) {
    streak = 0;
  }

  // Increment streak when user hits the daily threshold for the first time today
  if (cardsToday === STREAK_THRESHOLD) {
    if (lastStreakDate === yesterday || lastStreakDate === '') {
      streak++;
    } else if (lastStreakDate !== today) {
      // Streak was broken earlier; restart at 1
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
