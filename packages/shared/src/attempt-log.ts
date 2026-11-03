// A log of every answer a drill checks: which concept, right or not, and how
// long it took (#196, step 1).
//
// The mastery levels in #187 are computed from history, so the drills log from
// the day they ship: when the map arrives it starts full rather than empty.
//
// The log syncs to a signed-in account (#196). It is append-only, so the merge
// is a union keyed by each attempt's `id` (`mergeAttempts` in ./sync-merge),
// and it travels on its own append endpoint rather than in the progress PUT:
// a full log is far larger than a keepalive request may carry. This module
// owns the parts of that which are not about a network: the ids, the parser
// the server trusts, and which attempts a push still owes the account.
//
// A concept id is the app's to choose and must be stable: renaming one splits
// its history in two.

export interface Attempt {
  /**
   * Stable and unique, so a union merge can tell one attempt from another. Two
   * answers can share every other field: one check logs a whole table at the
   * same `at`, and the same concept can appear in it twice.
   */
  id: string;
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

/** What a drill hands the log. The log stamps the time and the id. */
export type NewAttempt = Omit<Attempt, 'id' | 'at'>;

/**
 * The most attempts kept. At a few dozen a day this is most of a year, and it
 * keeps the log well under localStorage's budget beside the SRS store. The
 * account keeps the same window, so a device that pulls gets the whole of it.
 */
export const MAX_ATTEMPTS = 5000;

/**
 * Most attempts one append request may carry, and so how a large backlog is
 * split: the first sign-in on a device with a full log sends five.
 */
export const MAX_ATTEMPTS_PER_REQUEST = 1000;

/**
 * Most attempts a keepalive push may carry. Browsers allow 64 KB of keepalive
 * bodies in flight at once, shared with the progress push sent beside it; at
 * ~130 bytes an attempt this is about 26 KB. A longer backlog waits for the
 * next push, or goes in full with the next pull or page load.
 */
export const KEEPALIVE_ATTEMPTS = 200;

/** Longest id and concept id the server accepts. Real ones are far shorter. */
export const MAX_ATTEMPT_ID_LENGTH = 64;
export const MAX_CONCEPT_LENGTH = 200;

/** A random id. `getRandomValues` is there in insecure contexts too, unlike `randomUUID`. */
export function newAttemptId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The optional fields, checked. Returns false on a wrong type. */
function optionalFieldsOk(a: Record<string, unknown>): boolean {
  if (a.ms !== undefined && !(typeof a.ms === 'number' && Number.isFinite(a.ms) && a.ms >= 0)) {
    return false;
  }
  return (
    a.confidence === undefined || a.confidence === 1 || a.confidence === 2 || a.confidence === 3
  );
}

/** The fields every attempt has had since the log shipped, without the id. */
function isStoredAttempt(v: unknown): v is Omit<Attempt, 'id'> & { id?: unknown } {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.concept === 'string' &&
    typeof a.correct === 'boolean' &&
    typeof a.at === 'number' &&
    Number.isFinite(a.at)
  );
}

/** Copy only the known fields, so nothing unexpected is stored or sent on. */
function clean(a: Attempt): Attempt {
  const out: Attempt = { id: a.id, concept: a.concept, correct: a.correct, at: a.at };
  if (a.ms !== undefined) out.ms = a.ms;
  if (a.confidence !== undefined) out.confidence = a.confidence;
  return out;
}

/**
 * One attempt from outside — a request body, a server response — or null. Strict:
 * an id is required and every field is checked, because the result lands in
 * typed database columns.
 */
export function parseAttempt(v: unknown): Attempt | null {
  if (!isStoredAttempt(v)) return null;
  const a = v as unknown as Record<string, unknown>;
  if (typeof a.id !== 'string' || a.id.length === 0 || a.id.length > MAX_ATTEMPT_ID_LENGTH) {
    return null;
  }
  if (v.concept.length === 0 || v.concept.length > MAX_CONCEPT_LENGTH) return null;
  if (!Number.isInteger(v.at) || v.at < 0) return null;
  if (!optionalFieldsOk(a)) return null;
  return clean(v as Attempt);
}

/**
 * The stored log, with an id on every entry. Entries written before ids
 * existed get one derived from their time and their place among the entries
 * sharing it, which is stable from one read to the next: they keep it once the
 * log is next written, by a drill or by a sync.
 */
function withIds(raw: unknown[]): Attempt[] {
  const seenAt = new Map<number, number>();
  const out: Attempt[] = [];
  for (const v of raw) {
    if (!isStoredAttempt(v) || !optionalFieldsOk(v as unknown as Record<string, unknown>)) {
      continue;
    }
    let id = v.id;
    if (typeof id !== 'string' || id.length === 0) {
      const n = seenAt.get(v.at) ?? 0;
      seenAt.set(v.at, n + 1);
      id = `legacy-${v.at}-${n}`;
    }
    out.push(clean({ ...v, id: id as string }));
  }
  return out;
}

/** Order two attempts by time, then id: a total order, the same on every device. */
export function compareAttempts(a: Attempt, b: Attempt): number {
  if (a.at !== b.at) return a.at - b.at;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The attempts in `log` that `remote` lacks, oldest first. */
export function attemptsMissingFrom(
  log: readonly Attempt[],
  remote: readonly Attempt[],
): Attempt[] {
  const have = new Set(remote.map((a) => a.id));
  return log.filter((a) => !have.has(a.id)).sort(compareAttempts);
}

export interface AttemptPush {
  /** What to send, oldest first. */
  batch: Attempt[];
  /** The cursor to keep once the batch is accepted. */
  nextCursor: number;
  /** Whether the batch is everything owed, or `limit` cut it short. */
  complete: boolean;
}

/**
 * Which attempts a push owes the account, given the cursor the last accepted
 * push left. `startedAt` is the clock when this push began, read *before* the
 * log was: anything logged after that has a later `at` and goes next time.
 *
 * The cursor is this device's clock, so it errs toward sending again rather
 * than skipping — the server ignores an id it already has. A batch cut short
 * by `limit` resumes at the first attempt it left out. Two things can still
 * leave an attempt behind (a clock set backwards; one check logging more than
 * `limit` answers at once), and a pull repairs both, because it sends exactly
 * what the account is missing (`attemptsMissingFrom`).
 */
export function planAttemptPush(
  log: readonly Attempt[],
  cursor: number,
  limit: number,
  startedAt: number,
): AttemptPush {
  const pending = log.filter((a) => a.at >= cursor).sort(compareAttempts);
  if (pending.length <= limit) return { batch: pending, nextCursor: startedAt, complete: true };
  const batch = pending.slice(0, limit);
  const resumeAt = pending[limit].at;
  // A batch that is one moment throughout would resume where it began, forever.
  const nextCursor = resumeAt === batch[0].at ? resumeAt + 1 : resumeAt;
  return { batch, nextCursor, complete: false };
}

/** Bind the log to one app's storage key; neither app may read the other's. */
export function createAttemptLog(storageKey: string) {
  function loadAttempts(): Attempt[] {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(raw) ? withIds(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Replace the log, keeping the newest `MAX_ATTEMPTS`. A storage failure is
   * swallowed: a lost log entry must never interrupt a study session.
   */
  function saveAttempts(attempts: readonly Attempt[]): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(attempts.slice(-MAX_ATTEMPTS).map(clean)));
    } catch {
      // See above.
    }
  }

  /** Append, dropping the oldest past `MAX_ATTEMPTS`. */
  function logAttempts(attempts: NewAttempt[], now = Date.now()): void {
    if (attempts.length === 0) return;
    saveAttempts([
      ...loadAttempts(),
      ...attempts.map((a) => clean({ ...a, id: newAttemptId(), at: now })),
    ]);
  }

  return { loadAttempts, logAttempts, saveAttempts };
}
