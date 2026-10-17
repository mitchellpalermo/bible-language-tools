// Paradigm cells as spaced-repetition cards (ROADMAP Phase 7, step 7d).
//
// Every form in a paradigm is its own card, so the quiz learns which forms a
// student keeps missing rather than which tables. Pure functions over the SRS
// store; `ParadigmQuiz.tsx` loads, calls these, and saves.
//
// Four decisions here are pedagogy, and each will look arbitrary without the
// reason:
//
// **A card is keyed by the cell's id, never its position.** `cellId()` is
// `<paradigm>:<pgn>`, the same in the verb layout and the summary layout, so
// the 3ms of כתב is one card whichever table it was answered in.
//
// **The grade follows the score.** A result that `countsAsCorrect` passes, and
// one that does not is `again`. Exactly right is `good`; a pointing slip that
// lenient marking forgives is `hard` — it advances the card, barely, and costs
// a little ease, because the form is not yet fully known. Nothing infers
// `easy`: a typed table cannot tell an effortless answer from a laboured one.
//
// **A repeat the same day can demote but not promote** (`shouldUpdateCard`).
// Try again straight after the results, or meet the strong verb again in its
// summary table, and a second pass would be short-term memory scheduled as
// though it were a spaced recall.
//
// **So can an attempt in which the student peeked.** Peek shows every answer at
// once, so after it nothing in the table is unaided recall. A miss after
// peeking is still a miss and still pulls the card in.

import { DENSITY_RATIO } from '@tools/shared/paradigm-quiz';
import {
  GRADE_QUALITY,
  isDue,
  isPassingGrade,
  newCard,
  nextSRS,
  type ReviewGrade,
  recordReview,
  type SRSCard,
  type StudyStats,
  shouldUpdateCard,
  todayStr,
} from '../data/srs';
import {
  type CellResult,
  countsAsCorrect,
  type Density,
  getQuizCells,
  type QuizCell,
  type TableModel,
} from './paradigm-quiz';

type Store = Record<string, SRSCard>;

// ─── Keys ─────────────────────────────────────────────────────────────────────

/**
 * The prefix for paradigm cards in the shared SRS store. Distinct from the
 * vocabulary's bare lemmas and the writing decks' `write:` keys — a paradigm
 * cell is a skill of its own. Build keys with `paradigmCardKey`, never here and
 * there by hand.
 */
export const PARADIGM_KEY_PREFIX = 'paradigm:';

export function paradigmCardKey(cellId: string): string {
  return `${PARADIGM_KEY_PREFIX}${cellId}`;
}

export function isParadigmKey(key: string): boolean {
  return key.startsWith(PARADIGM_KEY_PREFIX);
}

// ─── Grading ──────────────────────────────────────────────────────────────────

export function gradeForResult(result: CellResult, strict: boolean): ReviewGrade {
  if (!countsAsCorrect(result, strict)) return 'again';
  return result === 'correct' ? 'good' : 'hard';
}

export interface GradedCell {
  /** `cellId()` — a cell without one (no paradigm behind it) is not scheduled. */
  id?: string;
  result: CellResult;
}

export interface AttemptOptions {
  strict: boolean;
  /** Whether Peek was used at any point during the attempt. */
  peeked: boolean;
}

export interface AttemptOutcome {
  store: Store;
  stats: StudyStats;
  /** Cards the attempt moved, and where it moved them. */
  scheduled: SRSCard[];
}

/**
 * Apply one checked table to the store and the study stats.
 *
 * Stats count every graded cell — the student did the review either way —
 * while the card itself moves only when `shouldUpdateCard` allows it.
 */
export function recordAttempt(
  store: Store,
  stats: StudyStats,
  cells: GradedCell[],
  { strict, peeked }: AttemptOptions,
): AttemptOutcome {
  const today = todayStr();
  const next: Store = { ...store };
  const scheduled: SRSCard[] = [];
  let nextStats = stats;

  for (const { id, result } of cells) {
    const grade = gradeForResult(result, strict);
    nextStats = recordReview(nextStats, isPassingGrade(grade));
    if (!id) continue;

    const key = paradigmCardKey(id);
    const card = next[key] ?? newCard(key);
    const repeat = peeked || card.lastReviewed === today;
    if (!shouldUpdateCard(repeat, grade)) continue;

    next[key] = nextSRS(card, GRADE_QUALITY[grade]);
    scheduled.push(next[key]);
  }

  return { store: next, stats: nextStats, scheduled };
}

// ─── Progress ─────────────────────────────────────────────────────────────────

/** A cell is due when it has never been answered, or its card says so. */
export function isCellDue(cell: QuizCell, store: Store): boolean {
  if (!cell.id) return true;
  const card = store[paradigmCardKey(cell.id)];
  return !card || isDue(card);
}

export interface TableProgress {
  total: number;
  /** Never answered. */
  fresh: number;
  /** Answered before and due for review now. A miss comes back the next day. */
  due: number;
}

export function tableProgress(table: TableModel, store: Store): TableProgress {
  let fresh = 0;
  let due = 0;
  const cells = getQuizCells(table);
  for (const cell of cells) {
    const card = cell.id ? store[paradigmCardKey(cell.id)] : undefined;
    if (!card) fresh++;
    else if (isDue(card)) due++;
  }
  return { total: cells.length, fresh, due };
}

// ─── Blanking ─────────────────────────────────────────────────────────────────

/** The difficulty levels, plus `due`: blank exactly the forms that are due. */
export type BlankMode = Density | 'due';

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Choose the blanks for an attempt, due forms first.
 *
 * A density still sets how many cells are blank; the schedule decides which.
 * Due cells are drawn before the rest, each group in random order, so an Easy
 * quarter of a table lands on the forms that need it. `due` blanks exactly the
 * due cells, and blanks none when nothing is due — the caller says so rather
 * than quizzing something the schedule did not ask for.
 */
export function blankForReview(
  cells: QuizCell[],
  mode: BlankMode,
  store: Store,
  random: () => number = Math.random,
): QuizCell[] {
  const due = cells.filter((c) => isCellDue(c, store));
  const blanks =
    mode === 'due'
      ? due
      : [
          ...shuffle(due, random),
          ...shuffle(
            cells.filter((c) => !due.includes(c)),
            random,
          ),
        ].slice(0, Math.max(1, Math.round(cells.length * DENSITY_RATIO[mode])));
  const blankSet = new Set(blanks.map((c) => c.index));
  return cells.map((c) => ({ ...c, isBlank: blankSet.has(c.index) }));
}
