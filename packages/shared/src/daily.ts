/**
 * The two pieces of a "verse of the day" that have nothing to do with a
 * language: which entry today lands on, and the read-it-daily streak.
 *
 * Both apps run the same daily feature over different corpora, so this follows
 * the `createQuizSettings(storageKey)` pattern — a factory bound to one app's
 * key, because greek.tools and hebrew.tools must not share a streak. Reading
 * the Hebrew Bible is not reading the Greek New Testament, and a student who
 * does both has two streaks, not one.
 *
 * Everything here is deliberately **local-time**, not UTC. A daily feature that
 * rolls over at UTC midnight changes the verse in the middle of the evening for
 * most of the Americas and mid-morning for east Asia.
 */

// ─── Day selection ────────────────────────────────────────────────────────────

/**
 * A stable integer that increases by exactly one each local calendar day.
 *
 * `new Date(y, m, d)` is local midnight expressed as milliseconds from the UTC
 * epoch, so flooring it into days lands on a different absolute integer for
 * each timezone — east of UTC it names the previous UTC day. That is harmless
 * and deliberate: nothing depends on *which* integer a given date maps to, only
 * that it is the same all day and one greater tomorrow. Chasing "the same verse
 * worldwide" would mean picking someone's midnight to impose on everyone else.
 */
export function epochDay(now = new Date()): number {
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(localMidnight.getTime() / (1000 * 60 * 60 * 24));
}

/**
 * Today's index into a list of `length` entries, cycling.
 *
 * The double modulo is not redundant: `%` in JavaScript keeps the sign of the
 * dividend, so dates before 1970 would otherwise index negatively.
 */
export function dayIndex(length: number, now = new Date()): number {
  if (length <= 0) return 0;
  return ((epochDay(now) % length) + length) % length;
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export interface DailyStreakData {
  streak: number;
  /** The last day counted, as a local `YYYY-MM-DD`. Empty when never read. */
  lastReadDate: string;
}

const EMPTY: DailyStreakData = { streak: 0, lastReadDate: '' };

/**
 * A local calendar date as `YYYY-MM-DD`.
 *
 * Built from the local getters rather than `toISOString()`, which converts to
 * UTC first and so names yesterday for anyone west of Greenwich after their
 * evening — the exact hours a daily reading habit actually happens in.
 */
export function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The stored shape, or `null` for anything that is not it. */
function parse(raw: string | null): DailyStreakData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DailyStreakData>;
    if (typeof parsed?.streak !== 'number' || !Number.isFinite(parsed.streak)) return null;
    if (typeof parsed.lastReadDate !== 'string') return null;
    return { streak: parsed.streak, lastReadDate: parsed.lastReadDate };
  } catch {
    return null;
  }
}

/**
 * Streak persistence bound to one app's storage key.
 *
 * A corrupt or foreign value reads as "never read" rather than throwing. The
 * streak is an encouragement, and losing one is not a reason to fail the page
 * it is drawn on.
 */
export function createDailyStreak(storageKey: string) {
  function loadStreakData(): DailyStreakData {
    try {
      return parse(localStorage.getItem(storageKey)) ?? { ...EMPTY };
    } catch {
      return { ...EMPTY };
    }
  }

  /**
   * Count today, and return the streak including it.
   *
   * Idempotent within a calendar day — the page marks on mount, and opening it
   * four times is one day's reading. A missed day restarts at **1**, not 0:
   * today was still read, and showing "0-day streak" to someone who just read
   * would be both wrong and discouraging.
   */
  function markReadToday(now = new Date()): DailyStreakData {
    const today = localDateStr(now);

    const yd = new Date(now);
    yd.setDate(yd.getDate() - 1);
    const yesterday = localDateStr(yd);

    const prev = loadStreakData();
    if (prev.lastReadDate === today) return prev;

    const updated: DailyStreakData = {
      streak: prev.lastReadDate === yesterday ? prev.streak + 1 : 1,
      lastReadDate: today,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      /* a full or blocked store costs the streak, not the reading */
    }

    return updated;
  }

  return { loadStreakData, markReadToday };
}
