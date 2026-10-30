// This app's binding of `@tools/shared/ladder` for the pronominal suffix
// ladder (#186). The rungs are `src/data/suffix-ladder.ts`; the unlock rule is
// the shared module's. Progress is local only, like the attempt log, and is
// kept apart from greek.tools' by its key.

import {
  CLEAN_WRITES_TO_UNLOCK,
  createLadderProgress,
  isCleanWrite,
  type LadderProgress,
  newlyUnlocked,
  recordWrite,
} from '@tools/shared/ladder';
import { LADDER_RUNG_IDS } from '../data/suffix-ladder';
import type { CellResult, QuizCell } from './paradigm-quiz';

export const LADDER_PROGRESS_KEY = 'hebrew-tools-suffix-ladder-v1';

export const { loadLadderProgress, saveLadderProgress } = createLadderProgress(LADDER_PROGRESS_KEY);

/** What one checked table did on the ladder. */
export interface LadderOutcome {
  rungId: string;
  clean: boolean;
  /** Every cell was blank: the Full table mode, or a Due round that blanked all of it. */
  fullTable: boolean;
  peeked: boolean;
  progress: LadderProgress;
  /** The rung number this write opened, if it opened one. */
  unlocked?: number;
}

/**
 * Count a checked table toward the ladder. Clean means exactly right — a
 * pointing slip that lenient marking forgives still is not a clean write,
 * because the rung asks for the table reproduced, not recognised.
 */
export function ladderOutcome(
  progress: LadderProgress,
  rungId: string,
  cells: readonly QuizCell[],
  results: Record<number, CellResult>,
  peeked: boolean,
): LadderOutcome {
  const clean = isCleanWrite(cells, (c) => results[c.index] === 'correct', peeked);
  const next = recordWrite(progress, rungId, clean);
  return {
    rungId,
    clean,
    fullTable: cells.length > 0 && cells.every((c) => c.isBlank),
    peeked,
    progress: next,
    unlocked: newlyUnlocked(LADDER_RUNG_IDS, progress, next)?.number,
  };
}

/** The outcome in a sentence, for the results screen. */
export function ladderNote(outcome: LadderOutcome): string {
  const number = LADDER_RUNG_IDS.indexOf(outcome.rungId) + 1;
  const isTop = number === LADDER_RUNG_IDS.length;
  if (outcome.clean) {
    const writes = outcome.progress[outcome.rungId] ?? 0;
    if (outcome.unlocked) return `Clean write. Rung ${outcome.unlocked} is open.`;
    if (isTop) return `Clean write: ${writes} on the top rung.`;
    if (writes < CLEAN_WRITES_TO_UNLOCK) {
      return `Clean write: ${writes} of ${CLEAN_WRITES_TO_UNLOCK} toward rung ${number + 1}.`;
    }
    return `Clean write. Rung ${number + 1} is already open.`;
  }
  if (!outcome.fullTable) return 'Only a Full table write counts toward the next rung.';
  if (outcome.peeked) return 'You peeked, so this write does not count toward the next rung.';
  return 'Not a clean write: every form has to be exactly right, pointing included, to count toward the next rung.';
}
