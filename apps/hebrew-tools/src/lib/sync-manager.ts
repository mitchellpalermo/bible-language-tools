// Client-side sync lifecycle for signed-in users.
//
// Sync is a layer on top of the existing localStorage read/write paths in
// src/data/srs.ts — it never replaces them. localStorage stays the working copy
// during a study session; the server is a sync target and a backup, never the
// read path.
//
// Every network call here is caught and returns a boolean. A sync failure must
// never interrupt a study session, so only the account page surfaces errors.
//
// Two things sync, on two endpoints. The progress snapshot (cards, stats,
// streak, ladder) is small and goes whole to /api/progress. The attempt log is
// not: it is append-only and goes to /api/attempts in pieces, tracked by a
// cursor — see "The attempt log" below.

import {
  type Attempt,
  attemptsMissingFrom,
  KEEPALIVE_ATTEMPTS,
  MAX_ATTEMPTS_PER_REQUEST,
  parseAttempt,
  planAttemptPush,
} from '@tools/shared/attempt-log';
import { loadSRSStore, loadStats, SRS_KEY, STATS_KEY, saveSRSStore, saveStats } from '../data/srs';
import { ATTEMPT_LOG_KEY, loadAttempts, saveAttempts } from './attempt-log';
import { hasAuthHint } from './auth-cookie';
import { customDeckStore } from './custom-decks';
import { focusPassageStore } from './focus-passages';
import { loadStudyStreak, STUDY_STREAK_KEY, saveStudyStreak } from './study-streak';
import { LADDER_PROGRESS_KEY, loadLadderProgress, saveLadderProgress } from './suffix-ladder';
import {
  mergeAttempts,
  mergeCustomDecks,
  mergeFocusPassages,
  mergeLadderProgress,
  mergeProgress,
  type ProgressSnapshot,
} from './sync-merge';
import type { AttemptsPayload, ProgressPayload } from './sync-types';

export const LAST_SYNCED_KEY = 'hebrew-tools-last-synced';

/**
 * This device's clock when the last accepted attempt push began. Everything
 * logged since is still owed to the account. Absent means owed from the start.
 */
export const ATTEMPT_CURSOR_KEY = 'hebrew-tools-attempts-pushed-through';

// Keyed by user id so the import offer is once per account, not once per
// browser — a second account signed in on the same device still gets asked.
const IMPORT_OFFERED_PREFIX = 'hebrew-tools-import-offered';

export function hasImportBeenOffered(userId: string): boolean {
  try {
    return localStorage.getItem(`${IMPORT_OFFERED_PREFIX}:${userId}`) === '1';
  } catch {
    return false;
  }
}

export function markImportOffered(userId: string): void {
  try {
    localStorage.setItem(`${IMPORT_OFFERED_PREFIX}:${userId}`, '1');
  } catch {
    // localStorage unavailable — worst case the offer shows again
  }
}

export function getLastSyncedAt(): string | null {
  try {
    return localStorage.getItem(LAST_SYNCED_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncedAt(iso: string): void {
  try {
    localStorage.setItem(LAST_SYNCED_KEY, iso);
  } catch {
    // localStorage unavailable — sync status display degrades gracefully
  }
}

export function readLocalProgress(): ProgressSnapshot {
  return {
    srsStore: loadSRSStore(),
    studyStats: loadStats(),
    studyStreak: loadStudyStreak(),
    ladderProgress: loadLadderProgress(),
    // Tombstones too: they are how a deletion reaches the other devices.
    customDecks: customDeckStore.loadAll(),
    focusPassages: focusPassageStore.loadAll(),
  };
}

export function writeLocalProgress(snapshot: ProgressSnapshot): void {
  saveSRSStore(snapshot.srsStore);
  saveStats(snapshot.studyStats);
  if (snapshot.studyStreak) saveStudyStreak(snapshot.studyStreak);
  // Merged again with what is stored now, not just written: a clean write
  // checked while the pull was in flight must not be lost to it. The merge
  // only ever raises a count, so this is safe whatever the snapshot holds.
  if (snapshot.ladderProgress) {
    saveLadderProgress(mergeLadderProgress(loadLadderProgress(), snapshot.ladderProgress));
  }
  // Merged with what is stored now for the same reason: a deck made, edited or
  // deleted while the pull was in flight must not be lost to it.
  if (snapshot.customDecks) {
    customDeckStore.saveAll(mergeCustomDecks(customDeckStore.loadAll(), snapshot.customDecks));
  }
  if (snapshot.focusPassages) {
    focusPassageStore.saveAll(
      mergeFocusPassages(focusPassageStore.loadAll(), snapshot.focusPassages),
    );
  }
}

/**
 * Erase the progress this device would sync — the "Start fresh" import option,
 * which must leave nothing for the next push to upload. Throws if storage
 * cannot be written.
 *
 * Custom decks and focus passages are not progress and are not erased, here or
 * by the account reset: they are the student's own work, the server copy is left alone by
 * `DELETE /api/progress` too, and the reset's "keeps" list says so.
 */
export function clearLocalProgress(): void {
  for (const key of [
    SRS_KEY,
    STATS_KEY,
    STUDY_STREAK_KEY,
    LADDER_PROGRESS_KEY,
    ATTEMPT_LOG_KEY,
    ATTEMPT_CURSOR_KEY,
  ]) {
    localStorage.removeItem(key);
  }
}

/** Does this device have any study progress worth importing? */
export function hasLocalProgress(): boolean {
  const { srsStore } = readLocalProgress();
  return Object.values(srsStore).some((card) => card.repetition > 0);
}

async function putProgress(
  snapshot: ProgressSnapshot,
  init: RequestInit = {},
): Promise<string | null> {
  const response = await fetch('/api/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
    ...init,
  });
  if (!response.ok) return null;
  const { syncedAt } = (await response.json()) as { syncedAt: string };
  return syncedAt;
}

// ─── The attempt log ─────────────────────────────────────────────────────────
//
// A push sends what was logged since the cursor; a pull sends exactly what the
// account is missing. The cursor errs toward sending twice, which the server
// ignores, and the pull repairs anything it ever skips. See planAttemptPush in
// @tools/shared/attempt-log for the rules.

function getAttemptCursor(): number {
  try {
    const n = Number(localStorage.getItem(ATTEMPT_CURSOR_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function setAttemptCursor(at: number): void {
  try {
    localStorage.setItem(ATTEMPT_CURSOR_KEY, String(at));
  } catch {
    // localStorage unavailable — the next push sends the same attempts again
  }
}

/** Forget the cursor, so the next push owes the account the whole log. */
function resetAttemptCursor(): void {
  try {
    localStorage.removeItem(ATTEMPT_CURSOR_KEY);
  } catch {
    // See setAttemptCursor.
  }
}

async function postAttempts(
  attempts: readonly Attempt[],
  init: RequestInit = {},
): Promise<boolean> {
  const response = await fetch('/api/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attempts }),
    ...init,
  });
  return response.ok;
}

/** Send a list in requests the server accepts, oldest first, stopping at a failure. */
async function postAllAttempts(attempts: readonly Attempt[]): Promise<boolean> {
  for (let i = 0; i < attempts.length; i += MAX_ATTEMPTS_PER_REQUEST) {
    if (!(await postAttempts(attempts.slice(i, i + MAX_ATTEMPTS_PER_REQUEST)))) return false;
  }
  return true;
}

/**
 * Send what the account is owed since the cursor. A keepalive push sends one
 * request of at most `KEEPALIVE_ATTEMPTS`, fired at once beside the progress
 * push, because a page that is unloading may not run anything after an await.
 * Otherwise it sends the whole backlog. Never throws.
 */
export async function pushAttempts(init: RequestInit = {}): Promise<boolean> {
  try {
    const keepalive = init.keepalive === true;
    const limit = keepalive ? KEEPALIVE_ATTEMPTS : MAX_ATTEMPTS_PER_REQUEST;
    for (;;) {
      const startedAt = Date.now();
      const plan = planAttemptPush(loadAttempts(), getAttemptCursor(), limit, startedAt);
      if (plan.batch.length > 0 && !(await postAttempts(plan.batch, init))) return false;
      setAttemptCursor(plan.nextCursor);
      if (plan.complete || keepalive) return true;
    }
  } catch {
    return false;
  }
}

/**
 * Push the current local state to the server: the progress snapshot, and the
 * attempts logged since the last push. Both requests start before either is
 * awaited (see pushAttempts). Returns true when both succeed; never throws.
 */
export async function push(init: RequestInit = {}): Promise<boolean> {
  const attempts = pushAttempts(init);
  try {
    const syncedAt = await putProgress(readLocalProgress(), init);
    if (!syncedAt) return false;
    setLastSyncedAt(syncedAt);
  } catch {
    return false;
  }
  return attempts;
}

/**
 * Pull the account's attempts, merge them into this device's log, and send the
 * account whatever it lacks. Exact, unlike the cursor, which is why a pull
 * repairs anything a push skipped. Never throws.
 */
async function pullAndMergeAttempts(): Promise<boolean> {
  try {
    const startedAt = Date.now();
    const response = await fetch('/api/attempts');
    if (!response.ok) return false;
    const { attempts } = (await response.json()) as AttemptsPayload;
    const remote = (Array.isArray(attempts) ? attempts : [])
      .map(parseAttempt)
      .filter((a) => a !== null);
    // Read the log now, after the request, so nothing logged meanwhile is lost.
    const merged = mergeAttempts(loadAttempts(), remote);
    saveAttempts(merged);
    if (!(await postAllAttempts(attemptsMissingFrom(merged, remote)))) return false;
    setAttemptCursor(startedAt);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pull server progress, merge it with local state, and write the merged result
 * back to both sides; then the same for the attempt log, which runs alongside.
 * Returns `ok` (whether all of it succeeded) and `hadServerData` (whether the
 * server had prior progress for this account, used to route new vs. returning
 * users after sign-in). Never throws.
 */
export async function pullAndMerge(): Promise<{ hadServerData: boolean; ok: boolean }> {
  const [progress, attemptsOk] = await Promise.all([
    pullAndMergeProgress(),
    pullAndMergeAttempts(),
  ]);
  return { hadServerData: progress.hadServerData, ok: progress.ok && attemptsOk };
}

async function pullAndMergeProgress(): Promise<{ hadServerData: boolean; ok: boolean }> {
  try {
    const response = await fetch('/api/progress');
    if (!response.ok) return { hadServerData: false, ok: false };
    const { data } = (await response.json()) as { data: ProgressPayload | null };

    const hadServerData = data !== null;
    const local = readLocalProgress();
    const merged = data ? mergeProgress(local, data) : local;

    writeLocalProgress(merged);

    const syncedAt = await putProgress(merged);
    if (!syncedAt) return { hadServerData, ok: false };
    setLastSyncedAt(syncedAt);
    return { hadServerData, ok: true };
  } catch {
    return { hadServerData: false, ok: false };
  }
}

/**
 * Delete all server-side progress, the attempt log and the ladder included
 * (the account page's reset, and the "Start fresh" import option). The account
 * then holds no attempts, so the cursor resets: the next push owes it the
 * whole log.
 */
export async function deleteServerProgress(): Promise<boolean> {
  try {
    const response = await fetch('/api/progress', { method: 'DELETE' });
    if (response.ok) resetAttemptCursor();
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Send any attempts still owed, on page load. A keepalive push from a page
 * that was unloading cannot record that it landed, so its attempts stay owed;
 * this sends them, and anything past the keepalive cap, in full. Most loads
 * owe nothing and send nothing. Skipped when signed out.
 */
export function drainOwedAttempts(): void {
  if (!hasAuthHint()) return;
  void pushAttempts();
}

/**
 * Push progress when the tab is hidden — the "session end" signal. Uses
 * keepalive so the request survives navigation. Skipped when signed out.
 *
 * Browsers cap keepalive bodies at 64 KB in flight; a very large store makes
 * this particular push fail silently, and the next sign-in pull or manual
 * "Sync now" covers it. The attempts sent beside it are capped to fit
 * (`KEEPALIVE_ATTEMPTS`), and the next page load sends any the cap held back.
 */
export function registerSessionEndPush(target: Document = document): void {
  target.addEventListener('visibilitychange', () => {
    if (target.visibilityState !== 'hidden') return;
    if (!hasAuthHint()) return;
    void push({ keepalive: true });
  });
}

/** "Last synced 3 minutes ago" / "just now" — for the account page display. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
