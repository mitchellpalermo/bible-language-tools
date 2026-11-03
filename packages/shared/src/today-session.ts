/**
 * Today's Session: the parts of a daily, time-boxed study session that have
 * nothing to do with a language (#184 on hebrew.tools, #197 on greek.tools).
 *
 * An app turns its SRS store into candidates (each with a tier and an
 * estimated cost in seconds), and this module decides which ones fit the
 * student's time budget, which drill today's slot holds, and how much is due
 * tomorrow. What a candidate *is* — a vocabulary card, a paradigm cell — and
 * how it is studied stay in the app.
 *
 * Rules that are pedagogy rather than plumbing:
 *
 * - **Due before weak before new.** A due card that is skipped today is
 *   overdue tomorrow; a new card that waits a day costs nothing. So nothing
 *   from a lower tier is admitted once anything from a higher tier was left out
 *   for lack of time (`fillBudget`).
 * - **The budget is a ceiling, not a target.** The plan never adds up to more
 *   than the budget, so the only overrun is the estimates being wrong. #184's
 *   acceptance criterion allows 10% (`BUDGET_TOLERANCE`), and the fill itself
 *   spends none of it.
 * - **The study streak is its own streak**, separate from the daily verse's:
 *   reading a verse and doing a study session are two habits. It counts a day
 *   by the same local-date rule (see `./daily`).
 */

import { createDailyStreak, type DailyStreakData, dayIndex } from './daily';
import { localDateStr, type SRSCard } from './srs';

// ─── Budgets ──────────────────────────────────────────────────────────────────

/** The time budgets a student can pick, in minutes. */
export const SESSION_BUDGETS = [20, 45, 90] as const;
export type SessionBudget = (typeof SESSION_BUDGETS)[number];

/** How far over its budget a session may run: #184's acceptance criterion. */
export const BUDGET_TOLERANCE = 0.1;

export function isSessionBudget(value: unknown): value is SessionBudget {
  return SESSION_BUDGETS.includes(value as SessionBudget);
}

// ─── Filling the budget ───────────────────────────────────────────────────────

/** Most urgent first. */
export const SESSION_TIERS = ['due', 'weak', 'new'] as const;
export type SessionTier = (typeof SESSION_TIERS)[number];

export interface SessionCandidate {
  tier: SessionTier;
  /** What studying this one item costs, in seconds. */
  seconds: number;
  /**
   * Items that are studied together — the cells of one table — share a group,
   * and the group's own cost (`groupSeconds`: reading the table, checking it)
   * is paid once, by whichever of its items is admitted first.
   */
  group?: string;
  groupSeconds?: number;
}

export interface FilledBudget<C> {
  items: C[];
  seconds: number;
}

/**
 * The candidates that fit `budgetSeconds`, in tier order, keeping the
 * caller's order within a tier (sort by urgency before calling).
 *
 * A candidate that does not fit is skipped and the fill goes on, so a short
 * item can still use time a long one could not. But once anything in a tier
 * is skipped, no lower tier gets in: new material never takes time that due
 * work was refused.
 */
export function fillBudget<C extends SessionCandidate>(
  candidates: readonly C[],
  budgetSeconds: number,
): FilledBudget<C> {
  const items: C[] = [];
  const openGroups = new Set<string>();
  let seconds = 0;
  let blockedBelow: number = SESSION_TIERS.length;

  for (const [rank, tier] of SESSION_TIERS.entries()) {
    if (rank > blockedBelow) break;
    for (const c of candidates) {
      if (c.tier !== tier) continue;
      const opensGroup = c.group !== undefined && !openGroups.has(c.group);
      const cost = c.seconds + (opensGroup ? (c.groupSeconds ?? 0) : 0);
      if (seconds + cost > budgetSeconds) {
        blockedBelow = Math.min(blockedBelow, rank);
        continue;
      }
      seconds += cost;
      items.push(c);
      if (opensGroup) openGroups.add(c.group as string);
    }
  }

  return { items, seconds };
}

// ─── Weak cards ───────────────────────────────────────────────────────────────

/**
 * Below this ease a card counts as weak. Cards start at 2.5. One Again leaves
 * a card at 2.3, which is a slip; an Again and a Hard leave it at 2.15, which
 * is a pattern.
 */
export const WEAK_EASE = 2.2;

/** Scheduled, not due, and missed often enough to be worth seeing early. */
export function isWeak(card: SRSCard, today: string): boolean {
  return card.dueDate > today && card.easeFactor < WEAK_EASE;
}

// ─── The drill slot ───────────────────────────────────────────────────────────

/**
 * Today's drill: the rotation moves on one place a day, and a drill that has
 * nothing to offer today (no learned forms to review yet) passes its day to
 * the next one. `null` only when none is available.
 */
export function drillForToday<T>(
  rotation: readonly T[],
  isAvailable: (drill: T) => boolean,
  now = new Date(),
): T | null {
  const start = dayIndex(rotation.length, now);
  for (let i = 0; i < rotation.length; i++) {
    const drill = rotation[(start + i) % rotation.length];
    if (isAvailable(drill)) return drill;
  }
  return null;
}

// ─── The summary ──────────────────────────────────────────────────────────────

/** Cards whose key passes `includeKey` and that are due by the end of tomorrow. */
export function dueTomorrow(
  store: Record<string, SRSCard>,
  includeKey: (key: string) => boolean,
  now = new Date(),
): number {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const by = localDateStr(tomorrow);
  return Object.values(store).filter((c) => includeKey(c.key) && c.dueDate <= by).length;
}

// ─── The study streak ─────────────────────────────────────────────────────────

/**
 * The study streak, bound to one app's key. Its counting is the daily verse
 * streak's exactly: one day per local calendar day, idempotent within a day,
 * and a missed day restarting at 1. So it is that factory, under a key of its
 * own, rather than a second copy of the same rules. `markReadToday` is the
 * name it inherits; for this streak it means "finished a session today".
 */
export function createStudyStreak(storageKey: string) {
  const { loadStreakData, markReadToday } = createDailyStreak(storageKey);
  return { loadStudyStreak: loadStreakData, markStudiedToday: markReadToday };
}

/**
 * The streak as it stands today. The stored count is only still running when
 * its last day was today or yesterday; older than that, it has lapsed and
 * reads 0 until the next session restarts it at 1.
 */
export function currentStreak(data: DailyStreakData, now = new Date()): number {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const live = [localDateStr(now), localDateStr(yesterday)];
  return live.includes(data.lastReadDate) ? data.streak : 0;
}
