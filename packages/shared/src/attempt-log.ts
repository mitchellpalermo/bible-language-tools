// A log of every answer a drill checks: which concept, right or not, and how
// long it took (#196, step 1).
//
// The mastery levels in #187 are computed from history, so the drills log from
// the day they ship: when the map arrives it starts full rather than empty.
// Nothing reads the log yet, and it is local only. Whether it syncs waits on the
// sign-in decision in #196, and a union merge (see "Streaks, study days, and
// sync merges" in the repo CLAUDE.md) suits an append-only log anyway.
//
// A concept id is the app's to choose and must be stable: renaming one splits
// its history in two.

export interface Attempt {
  /** Stable concept id, e.g. `accent-shift/open-pretonic-long`. */
  concept: string;
  correct: boolean;
  /** Time to answer in milliseconds, when the drill measured it. */
  ms?: number;
  /** Self-rated confidence, 1 (guess) to 3 (sure), when the drill asked. */
  confidence?: 1 | 2 | 3;
  /** When it was answered, as epoch milliseconds. */
  at: number;
}

/**
 * The most attempts kept. At a few dozen a day this is most of a year, and it
 * keeps the log well under localStorage's budget beside the SRS store.
 */
export const MAX_ATTEMPTS = 5000;

function isAttempt(v: unknown): v is Attempt {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.concept === 'string' && typeof a.correct === 'boolean' && typeof a.at === 'number'
  );
}

/** Bind the log to one app's storage key; neither app may read the other's. */
export function createAttemptLog(storageKey: string) {
  function loadAttempts(): Attempt[] {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(raw) ? raw.filter(isAttempt) : [];
    } catch {
      return [];
    }
  }

  /**
   * Append, dropping the oldest past `MAX_ATTEMPTS`. A storage failure is
   * swallowed: a lost log entry must never interrupt a study session.
   */
  function logAttempts(attempts: Omit<Attempt, 'at'>[], now = Date.now()): void {
    if (attempts.length === 0) return;
    try {
      const next = [...loadAttempts(), ...attempts.map((a) => ({ ...a, at: now }))];
      localStorage.setItem(storageKey, JSON.stringify(next.slice(-MAX_ATTEMPTS)));
    } catch {
      // See above.
    }
  }

  return { loadAttempts, logAttempts };
}
