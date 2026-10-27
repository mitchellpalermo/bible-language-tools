// Paradigm quiz engine — the language-agnostic half.
//
// A paradigm table is rows × columns of forms, some of which a quiz blanks out.
// That much is the same for a Greek noun and a Hebrew verb, so it lives here;
// *which* tables exist and how an answer is graded are each app's business
// (`apps/*/src/lib/paradigm-quiz.ts`).

import type { Density } from './quiz-settings';

export type { Density };

/** A quiz-friendly, flat representation of a single paradigm table. */
export interface TableModel<Category extends string = string> {
  id: string;
  label: string;
  category: Category;
  /** Optional top-level grouping header spanning multiple leaf columns. */
  colGroups?: string[];
  /** Leaf-level column headers. */
  cols: string[];
  rows: TableRow[];
}

export interface TableRow {
  label: string;
  /**
   * One answer per leaf column. null means the form doesn't exist (a 1sg
   * imperative, a 3fp in a conjugation with a common plural) — never blanked.
   */
  answers: (string | null)[];
  /**
   * Optional stable identity per cell, parallel to `answers`.
   *
   * A cell's `index` is its position in *this* layout. Where the same form can
   * appear in more than one table — a Hebrew 3ms shows up in its own verb's
   * table and in the table comparing verb classes — progress has to follow the
   * form, not the position, and this is what it follows.
   */
  ids?: (string | null)[];
}

/** A single scoreable quiz cell (only cells with non-null answers). */
export interface QuizCell {
  /** Flat index into the cells array: rowIndex * cols.length + colIndex. */
  index: number;
  rowIndex: number;
  colIndex: number;
  answer: string;
  isBlank: boolean;
  /** The cell's layout-independent identity, where its row supplies one. */
  id?: string;
}

/**
 * Flatten a TableModel into an array of quiz cells.
 * Cells with null answers (missing forms) are excluded.
 */
export function getQuizCells(table: TableModel): QuizCell[] {
  const cells: QuizCell[] = [];
  table.rows.forEach((row, rowIndex) => {
    row.answers.forEach((answer, colIndex) => {
      if (answer === null) return;
      const id = row.ids?.[colIndex];
      cells.push({
        index: rowIndex * table.cols.length + colIndex,
        rowIndex,
        colIndex,
        answer,
        isBlank: false,
        ...(id ? { id } : {}),
      });
    });
  });
  return cells;
}

/** Fisher-Yates — returns a new array. */
function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The fraction of a table's cells each density blanks. */
export const DENSITY_RATIO: Record<Density, number> = {
  easy: 0.25,
  medium: 0.5,
  hard: 1.0,
};

/**
 * Mark which cells in the quiz cell array are blank for this attempt.
 * Always blanks at least one cell.
 * Returns a new array with `isBlank` set appropriately.
 */
export function applyDensity(
  cells: QuizCell[],
  density: Density,
  random: () => number = Math.random,
): QuizCell[] {
  const count = Math.max(1, Math.round(cells.length * DENSITY_RATIO[density]));
  const shuffled = shuffle(
    cells.map((c) => c.index),
    random,
  );
  const blankSet = new Set(shuffled.slice(0, count));
  return cells.map((c) => ({ ...c, isBlank: blankSet.has(c.index) }));
}
