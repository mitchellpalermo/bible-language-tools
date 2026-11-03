/**
 * The study streak: consecutive days on which the student finished a Today
 * session (#184 on hebrew.tools, #197 to come on greek.tools).
 *
 * It is its own streak, not the Daily verse streak (`./daily`) and not the
 * flashcard streak in `StudyStats`. Reading a verse is not a study session, and
 * ten flashcards are not a day's routine. Each app binds it to its own key, so
 * a student who studies Greek and Hebrew has two.
 *
 * Unlike the Daily verse streak it syncs, so it has a merge rule. The rules are
 * the ones in "Streaks, study days, and sync merges" in the repo CLAUDE.md:
 * dates are local, never UTC; `streak` travels with `lastSessionDate`; the
 * winner is picked by the date, not the number; and the merge is symmetric.
 */

import { localDateStr } from './srs';

export interface StudyStreakData {
  streak: number;
  /** The last day a session was finished, as a local `YYYY-MM-DD`. Empty when never. */
  lastSessionDate: string;
}

export function emptyStudyStreak(): StudyStreakData {
  return { streak: 0, lastSessionDate: '' };
}

/** The stored shape, or `null` for anything that is not it. */
export function parseStudyStreak(value: unknown): StudyStreakData | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<Record<keyof StudyStreakData, unknown>>;
  if (typeof v.streak !== 'number' || !Number.isInteger(v.streak) || v.streak < 0) return null;
  if (typeof v.lastSessionDate !== 'string') return null;
  if (v.lastSessionDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(v.lastSessionDate)) return null;
  return { streak: v.streak, lastSessionDate: v.lastSessionDate };
}

function dayBefore(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

/**
 * Count today. Idempotent within a day: a second session today is still one
 * day. A gap restarts at 1, because today was still studied.
 */
export function countSession(prev: StudyStreakData, now = new Date()): StudyStreakData {
  const today = localDateStr(now);
  if (prev.lastSessionDate === today) return prev;
  return {
    streak: prev.lastSessionDate === dayBefore(now) ? prev.streak + 1 : 1,
    lastSessionDate: today,
  };
}

/**
 * The streak as it stands today. A stored streak whose last day is before
 * yesterday is already broken, and shows as 0 until the next session.
 */
export function currentStudyStreak(data: StudyStreakData, now = new Date()): number {
  const today = localDateStr(now);
  return data.lastSessionDate === today || data.lastSessionDate === dayBefore(now)
    ? data.streak
    : 0;
}

/** Whether a session has already been finished today. */
export function studiedToday(data: StudyStreakData, now = new Date()): boolean {
  return data.lastSessionDate === localDateStr(now);
}

/**
 * Merge two devices' streaks. The later date wins and brings its own streak
 * with it; on the same date the longer streak wins. Picking by the number
 * alone would let an old, long, already-broken streak beat today's.
 */
export function mergeStudyStreak(a: StudyStreakData, b: StudyStreakData): StudyStreakData {
  if (a.lastSessionDate !== b.lastSessionDate) {
    return { ...(b.lastSessionDate > a.lastSessionDate ? b : a) };
  }
  return { ...(b.streak > a.streak ? b : a) };
}

/**
 * Streak persistence bound to one app's storage key. A corrupt value reads as
 * "never", and a storage failure costs the streak, never the session.
 */
export function createStudyStreak(storageKey: string) {
  function loadStudyStreak(): StudyStreakData {
    try {
      const raw = localStorage.getItem(storageKey);
      return (raw && parseStudyStreak(JSON.parse(raw))) || emptyStudyStreak();
    } catch {
      return emptyStudyStreak();
    }
  }

  function saveStudyStreak(data: StudyStreakData): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // See above.
    }
  }

  /** Count today's finished session, save it, and return the new streak. */
  function markSessionComplete(now = new Date()): StudyStreakData {
    const next = countSession(loadStudyStreak(), now);
    saveStudyStreak(next);
    return next;
  }

  return { loadStudyStreak, saveStudyStreak, markSessionComplete };
}
