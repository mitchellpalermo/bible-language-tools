// The paradigm ladder: a sequence of tables, ordered by difficulty, where each
// rung opens once the one below has been written cleanly (#186 on hebrew.tools,
// #199 to come on greek.tools).
//
// Nothing here names a language. An app supplies the rungs (which tables, in
// which order) and decides whether a cell is exactly right; this module owns
// what counts as a clean write, how many it takes, and which rungs are open.
//
// Three rules that are pedagogy rather than plumbing:
//
// - **A clean write is the whole table, from memory, exactly right.** Every
//   cell blank (Full table mode), every answer exact, and no peeking. Easy,
//   Medium and Due still work on any open rung; they just do not count toward
//   the next one, because filling in half a table is not reproducing it.
// - **Two clean writes open the next rung.** One can be luck. The count is per
//   rung and only ever goes up: a later miss does not close a rung again.
// - **A locked rung stays visible and can be opened anyway.** The lock is
//   advice about order, not a gate on content. A student who already knows the
//   segholates should not have to prove the suffixes first, and the route ahead
//   is worth seeing. Writing an opened rung cleanly counts as usual.

import type { QuizCell } from './paradigm-quiz';

/** Clean writes of a rung it takes to open the next one. */
export const CLEAN_WRITES_TO_UNLOCK = 2;

/** Clean writes so far, by rung id. A rung with none is simply absent. */
export type LadderProgress = Record<string, number>;

export interface RungState {
  id: string;
  /** 1-based, as the student sees it. */
  number: number;
  unlocked: boolean;
  cleanWrites: number;
  /** Clean writes of the rung below, which is what opens this one. 0 for the first rung. */
  belowWrites: number;
}

/** Each rung's state, in ladder order. The first rung is always open. */
export function rungStates(rungIds: readonly string[], progress: LadderProgress): RungState[] {
  return rungIds.map((id, i) => {
    const belowWrites = i === 0 ? 0 : (progress[rungIds[i - 1]] ?? 0);
    return {
      id,
      number: i + 1,
      unlocked: i === 0 || belowWrites >= CLEAN_WRITES_TO_UNLOCK,
      cleanWrites: progress[id] ?? 0,
      belowWrites,
    };
  });
}

/**
 * Whether an attempt is a clean write: every cell was blank, every answer is
 * exactly right, and the student did not peek. `isExact` is the app's grading.
 */
export function isCleanWrite(
  cells: readonly QuizCell[],
  isExact: (cell: QuizCell) => boolean,
  peeked: boolean,
): boolean {
  if (peeked || cells.length === 0) return false;
  return cells.every((cell) => cell.isBlank && isExact(cell));
}

/** Count a write. Only a clean one changes anything. */
export function recordWrite(
  progress: LadderProgress,
  rungId: string,
  clean: boolean,
): LadderProgress {
  if (!clean) return progress;
  return { ...progress, [rungId]: (progress[rungId] ?? 0) + 1 };
}

/** The rung a write opened, if it opened one. */
export function newlyUnlocked(
  rungIds: readonly string[],
  before: LadderProgress,
  after: LadderProgress,
): RungState | undefined {
  const was = rungStates(rungIds, before);
  return rungStates(rungIds, after).find((s, i) => s.unlocked && !was[i].unlocked);
}

/** "Opens after 2 clean writes of rung 3 (1 of 2 so far)." */
export function lockText(state: RungState): string {
  const so = Math.min(state.belowWrites, CLEAN_WRITES_TO_UNLOCK);
  return `Opens after ${CLEAN_WRITES_TO_UNLOCK} clean writes of rung ${state.number - 1} (${so} of ${CLEAN_WRITES_TO_UNLOCK} so far).`;
}

function isProgress(v: unknown): v is LadderProgress {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0);
}

/**
 * Bind ladder progress to one app's storage key; neither app may read the
 * other's. Local only, like the attempt log: syncing waits on #196's sign-in
 * decision. A storage failure is swallowed, and a corrupt value reads as a
 * fresh ladder — the worst case is a locked rung the student can open anyway.
 */
export function createLadderProgress(storageKey: string) {
  function loadLadderProgress(): LadderProgress {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
      return isProgress(raw) ? raw : {};
    } catch {
      return {};
    }
  }

  function saveLadderProgress(progress: LadderProgress): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      // See above.
    }
  }

  return { loadLadderProgress, saveLadderProgress };
}
