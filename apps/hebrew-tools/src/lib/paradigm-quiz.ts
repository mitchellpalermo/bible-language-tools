// Paradigm Quiz — which tables exist, and how an answer is graded.
//
// The blanking engine is shared with greek-tools (`@tools/shared/paradigm-quiz`).
// What is Hebrew is here: turning `verb-paradigms.ts` into tables, and grading a
// typed form. Mirrors greek-tools' `src/lib/paradigm-quiz.ts`.
//
// **One paradigm, two layouts.** The textbook prints a verb as person × number
// (Table 10.8, and the blank worksheet that goes with it) and prints verb
// classes side by side as PGN × class (Tables 9.6 and 10.7). Both are worth
// reproducing from memory and they are the same forms, so every cell carries an
// id of `<paradigm>:<pgn>` — the same in either layout. Anything that tracks
// how well a form is known must key on that id and never on a cell's position.

import type { TableModel as SharedTableModel, TableRow } from '@tools/shared/paradigm-quiz';
import {
  answerForm,
  CONJUGATION_LABELS,
  CONJUGATION_PGNS,
  type Conjugation,
  type Pgn,
  paradigmsFor,
  STEM_LABELS,
  VERB_CLASS_LABELS,
  type VerbClass,
  type VerbParadigm,
  verbParadigms,
} from '../data/verb-paradigms';
import {
  type AnswerResult,
  applyFinalForms,
  checkHebrewAnswer,
  stripCantillation,
} from './hebrew-input';

export {
  applyDensity,
  type Density,
  getQuizCells,
  type QuizCell,
  type TableRow,
} from '@tools/shared/paradigm-quiz';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Tables are grouped by conjugation, which is how the course meets them. */
export type Category = Conjugation;

export const ALL_CATEGORIES: Category[] = ['qatal', 'yiqtol', 'wayyiqtol'];

export const CATEGORY_LABELS: Record<Category, string> = CONJUGATION_LABELS;

/**
 * `verb` is one verb as person × number; `summary` is several verb classes side
 * by side as PGN × class.
 */
export type TableLayout = 'verb' | 'summary';

export interface TableModel extends SharedTableModel<Category> {
  layout: TableLayout;
}

/** Result of grading a single blank cell. */
export type CellResult = AnswerResult;

// ─── Cell identity ────────────────────────────────────────────────────────────

/** A form's identity across every table it appears in. */
export function cellId(paradigmId: string, pgn: Pgn): string {
  return `${paradigmId}:${pgn}`;
}

// ─── Table builders ───────────────────────────────────────────────────────────

/**
 * Rows of the person × number layout. The plural lists its candidates in order:
 * a prefixed conjugation has a 3mp and a 3fp, the qatal has one 3cp for both —
 * which the textbook prints against the 3m row, leaving the 3f plural empty.
 */
const PERSON_ROWS: { label: string; singular: Pgn; plural: Pgn[] }[] = [
  { label: '3m', singular: '3ms', plural: ['3mp', '3cp'] },
  { label: '3f', singular: '3fs', plural: ['3fp'] },
  { label: '2m', singular: '2ms', plural: ['2mp'] },
  { label: '2f', singular: '2fs', plural: ['2fp'] },
  { label: '1c', singular: '1cs', plural: ['1cp'] },
];

/** The classes the textbook's summary tables set side by side, in column order. */
const SUMMARY_CLASSES: VerbClass[] = ['strong', 'begadkephat', 'iii-he'];

function conjugationLabel(p: Pick<VerbParadigm, 'stem' | 'conjugation'>): string {
  return `${STEM_LABELS[p.stem]} ${CONJUGATION_LABELS[p.conjugation]}`;
}

/** "קטל (strong)" — or just the root, for a verb that is its own class. */
function verbLabel(p: VerbParadigm): string {
  const className = VERB_CLASS_LABELS[p.verbClass];
  return className === p.root ? p.root : `${p.root} (${className.toLowerCase()})`;
}

/** One verb as person × number: rows 3m–1c, columns Singular and Plural. */
export function buildVerbTable(paradigm: VerbParadigm): TableModel {
  const rows: TableRow[] = PERSON_ROWS.map((row) => {
    const pgns: (Pgn | undefined)[] = [
      row.singular,
      row.plural.find((pgn) => paradigm.forms[pgn] !== undefined),
    ];
    return {
      label: row.label,
      answers: pgns.map((pgn) => formAt(paradigm, pgn)),
      ids: pgns.map((pgn) => (pgn && paradigm.forms[pgn] ? cellId(paradigm.id, pgn) : null)),
    };
  });

  return {
    id: paradigm.id,
    label: `${conjugationLabel(paradigm)} — ${verbLabel(paradigm)}`,
    category: paradigm.conjugation,
    layout: 'verb',
    cols: ['Singular', 'Plural'],
    rows,
  };
}

/**
 * Verb classes side by side: rows are the conjugation's PGNs in textbook
 * order, one column per class. Undefined when fewer than two classes have the
 * conjugation — a one-column summary is just the verb table over again.
 */
export function buildSummaryTable(conjugation: Conjugation): TableModel | undefined {
  const paradigms = SUMMARY_CLASSES.map((verbClass) =>
    paradigmsFor(conjugation).find((p) => p.verbClass === verbClass),
  ).filter((p): p is VerbParadigm => p !== undefined);
  if (paradigms.length < 2) return undefined;

  return {
    id: `${paradigms[0].stem}-${conjugation}-summary`,
    label: `${conjugationLabel(paradigms[0])} — summary`,
    category: conjugation,
    layout: 'summary',
    cols: paradigms.map((p) => `${VERB_CLASS_LABELS[p.verbClass]} (${p.root})`),
    rows: CONJUGATION_PGNS[conjugation].map((pgn) => ({
      label: pgn,
      answers: paradigms.map((p) => formAt(p, pgn)),
      ids: paradigms.map((p) => (p.forms[pgn] ? cellId(p.id, pgn) : null)),
    })),
  };
}

function formAt(paradigm: VerbParadigm, pgn: Pgn | undefined): string | null {
  const form = pgn ? paradigm.forms[pgn] : undefined;
  return form ? answerForm(form) : null;
}

/** Build all available TableModels: each conjugation's summary, then its verbs. */
export function buildTableModels(): TableModel[] {
  return ALL_CATEGORIES.flatMap((conjugation) => {
    const summary = buildSummaryTable(conjugation);
    const verbs = verbParadigms.filter((p) => p.conjugation === conjugation).map(buildVerbTable);
    return summary ? [summary, ...verbs] : verbs;
  });
}

// ─── Grading ──────────────────────────────────────────────────────────────────

/**
 * Grade what was typed into a cell against the cell's answer.
 *
 * The input is finalized first: the keyboard mapping stores a word's last
 * letter in its ordinary form and only *displays* the final one, so the raw
 * value of a correctly typed בְּנִיתֶם ends in מ.
 */
export function gradeCell(input: string, answer: string): CellResult {
  return checkHebrewAnswer(applyFinalForms(stripCantillation(input.trim())), answerForm(answer));
}

/**
 * Whether a result scores as right. Lenient marking forgives pointing — a
 * wrong vowel or a missing dagesh — and never a wrong consonant. The cell still
 * shows what was off either way; this only decides the score.
 */
export function countsAsCorrect(result: CellResult, strict: boolean): boolean {
  if (result === 'correct') return true;
  return !strict && result !== 'wrong';
}
