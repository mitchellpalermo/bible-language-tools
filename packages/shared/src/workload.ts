// The workload guard (#190, #203): how long today's reviews will take, and the
// suggestion to stop adding new cards while that is past the student's limit.
//
// Review piles are what make students quit. Every new card studied today is a
// review owed tomorrow, so the lever a student controls is how many strangers
// they let in. The guard estimates the day's reviews from the due cards and the
// student's own pace, and past a limit (20 minutes unless they change it)
// offers to pause new cards in SRS Review until the estimate comes back down.
//
// Pure, apart from `createWorkloadStore`, which binds the state to one app's
// storage key. Both apps run the guard; neither reads the other's.

import { isDue, type SRSCard } from './srs';

/** The limit a new student starts with, in minutes. */
export const DEFAULT_LIMIT_MINUTES = 20;
/** The limits the student can pick from. */
export const LIMIT_CHOICES = [10, 15, 20, 30, 45, 60] as const;

/**
 * Seconds a review is assumed to take until the student has a pace of their
 * own. The same figure both apps' Today's Session plans a vocabulary card with.
 */
export const DEFAULT_SECONDS_PER_REVIEW = 10;
/** Answers needed before the student's own pace replaces the default. */
export const MIN_PACE_SAMPLES = 10;
/** How many recent answers the pace is taken over. */
export const PACE_WINDOW = 50;
/**
 * An answer slower than this is a student who looked away, not one who was
 * thinking, and is not counted.
 */
export const MAX_ANSWER_SECONDS = 120;

export interface WorkloadState {
  /** Whether SRS Review deals cards never studied before. */
  pauseNew: boolean;
  /** The estimate past which pausing is suggested, in minutes. */
  limitMinutes: number;
  /** Seconds per answer, oldest first, at most `PACE_WINDOW` of them. */
  paceSeconds: number[];
}

export function defaultWorkloadState(): WorkloadState {
  return { pauseNew: false, limitMinutes: DEFAULT_LIMIT_MINUTES, paceSeconds: [] };
}

/** A stored value read defensively: anything malformed falls back field by field. */
export function parseWorkloadState(raw: unknown): WorkloadState {
  const fallback = defaultWorkloadState();
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const limit = r.limitMinutes;
  return {
    pauseNew: typeof r.pauseNew === 'boolean' ? r.pauseNew : fallback.pauseNew,
    limitMinutes:
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? limit
        : fallback.limitMinutes,
    paceSeconds: Array.isArray(r.paceSeconds)
      ? r.paceSeconds
          .filter((s): s is number => typeof s === 'number' && s > 0 && s <= MAX_ANSWER_SECONDS)
          .slice(-PACE_WINDOW)
      : fallback.paceSeconds,
  };
}

/**
 * The guard's state for one app. Local to the browser and never synced: the
 * pace is this device's (a phone and a laptop are not answered at the same
 * speed), and the pause is a setting, like the card-face preference.
 */
export function createWorkloadStore(storageKey: string) {
  return {
    load(): WorkloadState {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? parseWorkloadState(JSON.parse(raw)) : defaultWorkloadState();
      } catch {
        return defaultWorkloadState();
      }
    },
    save(state: WorkloadState): void {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // A full or blocked storage loses a setting, not a review.
      }
    },
  };
}

/** The pace after one more answer. A walk-away (`MAX_ANSWER_SECONDS`) is dropped. */
export function recordPace(samples: readonly number[], seconds: number): number[] {
  if (!(seconds > 0) || seconds > MAX_ANSWER_SECONDS) return [...samples];
  return [...samples, seconds].slice(-PACE_WINDOW);
}

/**
 * Seconds per review: the median of the recent answers, once there are enough,
 * else `fallback`. The median, so one slow card does not move the estimate.
 */
export function secondsPerReview(
  samples: readonly number[],
  fallback: number = DEFAULT_SECONDS_PER_REVIEW,
): number {
  if (samples.length < MIN_PACE_SAMPLES) return fallback;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Cards due today across the whole store, whatever deck is open: the day's
 * reviews are owed whichever deck they are studied through. `counts` leaves
 * out keys that are not flashcards, such as hebrew.tools' paradigm forms,
 * which share its store but are reviewed elsewhere and at another pace.
 */
export function countDue(
  store: Readonly<Record<string, SRSCard>>,
  counts: (key: string) => boolean = () => true,
): number {
  let n = 0;
  for (const [key, card] of Object.entries(store)) if (counts(key) && isDue(card)) n++;
  return n;
}

export interface WorkloadEstimate {
  due: number;
  seconds: number;
  /** Rounded up, so "about 21 minutes" is never shown for a pile past 21. */
  minutes: number;
  limitMinutes: number;
  overLimit: boolean;
}

export function estimateWorkload(
  due: number,
  pace: number,
  limitMinutes: number,
): WorkloadEstimate {
  const seconds = Math.round(due * pace);
  return {
    due,
    seconds,
    minutes: Math.ceil(seconds / 60),
    limitMinutes,
    overLimit: seconds > limitMinutes * 60,
  };
}

/**
 * What the guard suggests: pausing when the pile is past the limit and new
 * cards are still coming, resuming once it is back under while they are
 * paused. Resuming is a suggestion, never automatic, so new cards do not
 * reappear on a day the student did not expect them.
 */
export function workloadAdvice(
  estimate: WorkloadEstimate,
  pauseNew: boolean,
): 'pause' | 'resume' | null {
  if (!pauseNew && estimate.overLimit) return 'pause';
  if (pauseNew && !estimate.overLimit) return 'resume';
  return null;
}
