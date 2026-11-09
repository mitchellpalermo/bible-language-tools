// This app's binding of `@tools/shared/ladder` for the paradigm ladder (#199).
// The rungs are `src/data/paradigm-ladder.ts`; the unlock rule is the shared
// module's. Progress is kept apart from hebrew.tools' by its key and by the
// `language` column on the server, and synced when signed in, through
// `sync-manager.ts`.

import {
  CLEAN_WRITES_TO_UNLOCK,
  createLadderProgress,
  isCleanWrite,
  type LadderProgress,
  newlyUnlocked,
  recordWrite,
} from '@tools/shared/ladder';
import { LADDER_RUNG_IDS } from '../data/paradigm-ladder';
import { isExactAnswer } from './greek-input';
import type { QuizCell } from './paradigm-quiz';

export const LADDER_PROGRESS_KEY = 'greek-tools-paradigm-ladder-v1';

export const { loadLadderProgress, saveLadderProgress } = createLadderProgress(LADDER_PROGRESS_KEY);

/** What one checked table did on the ladder. */
export interface LadderOutcome {
  rungId: string;
  clean: boolean;
  /** Every cell was blank: the Full Recall difficulty. */
  fullTable: boolean;
  peeked: boolean;
  accentStrict: boolean;
  progress: LadderProgress;
  /** The rung number this write opened, if it opened one. */
  unlocked?: number;
}

/**
 * Count a checked table toward the ladder.
 *
 * Clean means every form exactly right: the letters, breathings and iota
 * subscripts always, and the accent marks when the student has Accents on
 * (`isExactAnswer`). A form that is only wrong in its accent while Accents is
 * off still counts, because a Greek course commonly does not test accents and
 * the quiz already tells the student they are ignored; a form that is wrong in
 * a breathing or an iota subscript never does.
 */
export function ladderOutcome(
  progress: LadderProgress,
  rungId: string,
  cells: readonly QuizCell[],
  inputs: Record<number, string>,
  peeked: boolean,
  accentStrict: boolean,
): LadderOutcome {
  const clean = isCleanWrite(
    cells,
    (c) => isExactAnswer(inputs[c.index] ?? '', c.answer, accentStrict),
    peeked,
  );
  const next = recordWrite(progress, rungId, clean);
  return {
    rungId,
    clean,
    fullTable: cells.length > 0 && cells.every((c) => c.isBlank),
    peeked,
    accentStrict,
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
  if (!outcome.fullTable) return 'Only a Full Recall write counts toward the next rung.';
  if (outcome.peeked) return 'You peeked, so this write does not count toward the next rung.';
  return outcome.accentStrict
    ? 'Not a clean write: every form has to be exactly right, accents included, to count toward the next rung.'
    : 'Not a clean write: every form has to be exactly right, breathings and iota subscripts included, to count toward the next rung. Accents are not checked while Accents is off.';
}
