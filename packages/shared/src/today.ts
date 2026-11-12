/**
 * Today's Session: one daily queue sized to a time budget (#184 on
 * hebrew.tools, #197 on greek.tools).
 *
 * This module is the part that names no language: the queue builder, the
 * clock that enforces the budget while the session runs, and the end-of-session
 * summary. Each app supplies its candidates — which cards and forms are due,
 * weak or new, and how long each takes — and which drill is in today's slot.
 *
 * Rules that are pedagogy rather than plumbing:
 *
 * - **Due before weak before new, across every section.** A tier is offered
 *   to every section before the next tier is offered to any. Once a tier has
 *   something left out for lack of room, the lower tiers get nothing: a new
 *   card in a session that left a due card behind is the pile-up the session
 *   exists to prevent.
 * - **Within a tier, sections share the time.** Each takes a turn by whichever
 *   has spent least so far, so a long vocabulary backlog cannot starve the
 *   paradigms, or the other way round.
 * - **The drill is reserved first.** It is the one part of the session that
 *   is not review, and it is what the issue asks the session to end on.
 * - **The plan fits the budget; the clock enforces it.** The plan uses
 *   estimates, so while the session runs `canStartNext` refuses an item once
 *   the budget is used or the item would end past `OVERRUN_ALLOWANCE` over it.
 *   An item already started is finished, never cut off.
 */

// ─── Budget ───────────────────────────────────────────────────────────────────

export const TIME_BUDGETS = [20, 45, 90] as const;
export type TimeBudget = (typeof TIME_BUDGETS)[number];

/** How far past the budget a session may run: 10%, per #184. */
export const OVERRUN_ALLOWANCE = 0.1;

export function isTimeBudget(value: unknown): value is TimeBudget {
  return TIME_BUDGETS.includes(value as TimeBudget);
}

// ─── The plan ─────────────────────────────────────────────────────────────────

/**
 * - `due`: the schedule says so.
 * - `weak`: not due, but the student has been missing it.
 * - `new`: never studied.
 */
export type Tier = 'due' | 'weak' | 'new';
export const TIERS: readonly Tier[] = ['due', 'weak', 'new'];

export interface Candidate<T> {
  /** Unique within its section. */
  id: string;
  tier: Tier;
  /** Estimated time to answer, in seconds. */
  seconds: number;
  payload: T;
}

export interface SectionInput<T> {
  id: string;
  /** In priority order within each tier (most overdue first, say). */
  candidates: readonly Candidate<T>[];
  /** At most this many `new` candidates. Absent means no cap. */
  maxNew?: number;
}

export interface DrillSlot<D> {
  id: string;
  seconds: number;
  payload: D;
}

export interface PlanInput<T, D> {
  budget: TimeBudget;
  /** In the order the session runs them. */
  sections: readonly SectionInput<T>[];
  drill?: DrillSlot<D> | null;
}

export interface PlannedSection<T> {
  id: string;
  /** In the order they run: due, then weak, then new. */
  items: Candidate<T>[];
}

export interface TodayPlan<T, D> {
  budget: TimeBudget;
  sections: PlannedSection<T>[];
  drill: DrillSlot<D> | null;
  /** The plan's estimated length, drill included. Never more than the budget. */
  plannedSeconds: number;
  /** Candidates of each tier the budget had no room for (caps not counted). */
  leftOut: Record<Tier, number>;
}

/** Fill a time budget from due work first, then weak, then new. */
export function buildTodayPlan<T, D>({
  budget,
  sections,
  drill,
}: PlanInput<T, D>): TodayPlan<T, D> {
  const budgetSeconds = budget * 60;
  const slot = drill && drill.seconds <= budgetSeconds ? drill : null;
  let spent = slot ? slot.seconds : 0;

  const chosen = sections.map(
    () => ({ due: [], weak: [], new: [] }) as Record<Tier, Candidate<T>[]>,
  );
  const leftOut: Record<Tier, number> = { due: 0, weak: 0, new: 0 };
  let blocked = false;

  for (const tier of TIERS) {
    const queues = sections.map((s) => {
      const inTier = s.candidates.filter((c) => c.tier === tier);
      return tier === 'new' && s.maxNew !== undefined ? inTier.slice(0, s.maxNew) : inTier;
    });

    if (blocked) {
      for (const q of queues) leftOut[tier] += q.length;
      continue;
    }

    const next = queues.map(() => 0);
    const tierSpent = queues.map(() => 0);
    for (;;) {
      // The section with something left that has spent least on this tier.
      let pick = -1;
      for (let i = 0; i < queues.length; i++) {
        if (next[i] >= queues[i].length) continue;
        if (pick === -1 || tierSpent[i] < tierSpent[pick]) pick = i;
      }
      if (pick === -1) break;

      const candidate = queues[pick][next[pick]++];
      if (spent + candidate.seconds <= budgetSeconds) {
        chosen[pick][tier].push(candidate);
        spent += candidate.seconds;
        tierSpent[pick] += candidate.seconds;
      } else {
        // Skipped for room. A smaller one behind it may still fit, but no
        // lower tier will be offered anything.
        leftOut[tier]++;
        blocked = true;
        // Stop this section's turn from looking cheap forever.
        tierSpent[pick] += candidate.seconds;
      }
    }
  }

  return {
    budget,
    sections: sections.map((s, i) => ({
      id: s.id,
      items: TIERS.flatMap((tier) => chosen[i][tier]),
    })),
    drill: slot,
    plannedSeconds: spent,
    leftOut,
  };
}

/** How many planned items there are in each tier, across sections. */
export function planTierCounts<T>(
  plan: Pick<TodayPlan<T, unknown>, 'sections'>,
): Record<Tier, number> {
  const counts: Record<Tier, number> = { due: 0, weak: 0, new: 0 };
  for (const s of plan.sections) for (const item of s.items) counts[item.tier]++;
  return counts;
}

// ─── The clock ────────────────────────────────────────────────────────────────

/**
 * Time spent with the session in view. Paused while the tab is hidden, so a
 * session left open over lunch does not end itself on return.
 */
export function createActiveClock(now: () => number = () => Date.now()) {
  let total = 0;
  let since: number | null = null;

  return {
    start() {
      if (since === null) since = now();
    },
    pause() {
      if (since !== null) {
        total += now() - since;
        since = null;
      }
    },
    elapsedMs(): number {
      return total + (since === null ? 0 : now() - since);
    },
    get running() {
      return since !== null;
    },
  };
}

export type ActiveClock = ReturnType<typeof createActiveClock>;

/**
 * Whether the next item may start: not once the budget is used, and not if
 * its estimate would carry the session past the allowance.
 */
export function canStartNext(elapsedMs: number, nextSeconds: number, budget: TimeBudget): boolean {
  const budgetMs = budget * 60_000;
  return (
    elapsedMs < budgetMs && elapsedMs + nextSeconds * 1000 <= budgetMs * (1 + OVERRUN_ALLOWANCE)
  );
}

// ─── The summary ──────────────────────────────────────────────────────────────

export interface Outcome {
  section: string;
  id: string;
  correct: boolean;
}

export interface SectionTally {
  reviewed: number;
  missed: number;
}

export interface SessionSummary extends SectionTally {
  bySection: Record<string, SectionTally>;
  /** What was missed, by section, in the order it was missed. */
  missedIds: Record<string, string[]>;
}

/**
 * Items reviewed and missed. Only an item's first outcome counts: a drill
 * asks a missed card again, and the second answer comes after seeing it.
 */
export function summarizeSession(outcomes: readonly Outcome[]): SessionSummary {
  const seen = new Set<string>();
  const summary: SessionSummary = { reviewed: 0, missed: 0, bySection: {}, missedIds: {} };
  for (const { section, id, correct } of outcomes) {
    const key = `${section}\u0000${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    summary.bySection[section] = summary.bySection[section] ?? { reviewed: 0, missed: 0 };
    const tally = summary.bySection[section];
    tally.reviewed++;
    summary.reviewed++;
    if (!correct) {
      tally.missed++;
      summary.missed++;
      summary.missedIds[section] = [...(summary.missedIds[section] ?? []), id];
    }
  }
  return summary;
}

/** "about 18 minutes" — estimates are rounded up, never down. */
export function formatMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
