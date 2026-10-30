// The step-gated drill: one item worked through a fixed sequence of steps, each
// checked before the next unlocks (#185, and its greek.tools counterpart #198).
//
// Nothing here names a language. An app supplies the steps and decides what a
// right answer is; this module owns the order, the gate, which steps were right
// first time, and when a student has earned the right to skip the scaffold.
//
// Three rules that are pedagogy rather than plumbing:
//
// - **A step is scored on its first try.** A miss leaves the step open so the
//   student can correct it with the feedback in front of them, and the second
//   try is not unaided recall. `firstTry` records the first answer only.
// - **"Show me" fills the answer and counts as a miss.** Without it a student
//   stuck on step 1 can never reach the form the item is about.
// - **The scaffold is skippable only on evidence.** `canSkipScaffold` reads the
//   last full window of scaffold steps, so one lucky item cannot unlock speed
//   mode. Speed mode answers no scaffold steps, so it stays earned until the
//   student goes back to the full steps and misses enough to lose it.

// ─── One item ────────────────────────────────────────────────────────────────

export interface StepDrillState {
  /** Index of the open step; equal to the step count once the item is done. */
  step: number;
  /** One entry per step answered so far: whether its first try was right. */
  firstTry: boolean[];
  /** Whether the open step has been missed at least once. */
  missedOpenStep: boolean;
  /** Rule ids behind the latest miss on the open step, for the feedback panel. */
  feedback: string[];
}

export type StepDrillAction =
  | { type: 'answer'; correct: boolean; rules?: string[] }
  | { type: 'reveal' }
  | { type: 'reset'; startAt: number };

/** A fresh item, starting at `startAt` (past the scaffold in speed mode). */
export function initialStepDrill(startAt = 0): StepDrillState {
  return { step: startAt, firstTry: [], missedOpenStep: false, feedback: [] };
}

function advance(state: StepDrillState, right: boolean): StepDrillState {
  return {
    step: state.step + 1,
    firstTry: [...state.firstTry, right],
    missedOpenStep: false,
    feedback: [],
  };
}

export function stepDrillReducer(state: StepDrillState, action: StepDrillAction): StepDrillState {
  switch (action.type) {
    case 'answer':
      if (action.correct) return advance(state, !state.missedOpenStep);
      return { ...state, missedOpenStep: true, feedback: action.rules ?? [] };
    case 'reveal':
      return advance(state, false);
    case 'reset':
      return initialStepDrill(action.startAt);
  }
}

/** Whether every step of the item was answered and none needed a second try. */
export function isCleanPass(state: StepDrillState, stepCount: number): boolean {
  return state.step >= stepCount && state.firstTry.every(Boolean);
}

// ─── Skipping the scaffold ───────────────────────────────────────────────────

export interface SkipPolicy {
  /** How many recent scaffold steps are judged. */
  window: number;
  /** The share of them that must have been right first time. */
  threshold: number;
}

export const DEFAULT_SKIP_POLICY: SkipPolicy = { window: 20, threshold: 0.9 };

/**
 * Whether the recent scaffold record earns speed mode.
 *
 * `history` is first-try results of scaffold steps, oldest first. Fewer than a
 * full window never qualifies: four right answers out of four is not evidence.
 */
export function canSkipScaffold(history: boolean[], policy = DEFAULT_SKIP_POLICY): boolean {
  if (history.length < policy.window) return false;
  const recent = history.slice(-policy.window);
  return recent.filter(Boolean).length / recent.length >= policy.threshold;
}

/** Append results and keep only what the policy will ever read. */
export function pushHistory(
  history: boolean[],
  results: boolean[],
  policy = DEFAULT_SKIP_POLICY,
): boolean[] {
  return [...history, ...results].slice(-policy.window);
}

/**
 * Bind the scaffold record to one app's storage key, so neither app's speed
 * mode can be earned in the other. Storage failures fall back to an empty
 * record: losing it costs a few items of scaffolding, never a session.
 */
export function createStepDrillHistory(storageKey: string) {
  function loadHistory(): boolean[] {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(raw) ? raw.filter((v): v is boolean => typeof v === 'boolean') : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history: boolean[]): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch {
      // See above.
    }
  }

  return { loadHistory, saveHistory };
}
