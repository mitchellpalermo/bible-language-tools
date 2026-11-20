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
  SUFFIX_PGNS,
  SUFFIX_SET_LABELS,
  type SuffixParadigm,
  type SuffixPgn,
  suffixParadigms,
} from '../data/pronominal-suffixes';
import {
  STEM_NAME_LABELS,
  STEM_NAMES,
  STEM_PATTERN_SOURCE,
  STEM_PATTERNS,
  STEM_ROOTS,
  stemColumnId,
} from '../data/stem-patterns';
import { type LadderRung, ladderRungs } from '../data/suffix-ladder';
import {
  answerForm,
  CONJUGATION_KEYS,
  CONJUGATION_LABELS,
  type FiniteConjugation,
  type FormKey,
  groupOf,
  type Pgn,
  paradigmsFor,
  QAL_GROUP_LABELS,
  QAL_GROUPS,
  type QalGroup,
  qalGrid,
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

/**
 * Tables are grouped as the Grammar Reference groups the Qal (`QalGroup`): a
 * finite conjugation each, and the infinitives and the participles each as
 * one. The pronominal suffixes on nouns sit in a group of their own, and the
 * suffix ladder (#186) in another.
 */
export type Category = QalGroup | 'stems' | 'suffixes' | 'ladder';

export const ALL_CATEGORIES: Category[] = [...QAL_GROUPS, 'stems', 'suffixes', 'ladder'];

/** A Qal tab holds Qal verb tables; the other tabs hold something else. */
export function isQalGroup(category: Category): category is QalGroup {
  return category !== 'stems' && category !== 'suffixes' && category !== 'ladder';
}

export const CATEGORY_LABELS: Record<Category, string> = {
  ...QAL_GROUP_LABELS,
  stems: 'Stem names',
  suffixes: 'Noun suffixes',
  ladder: 'Suffix ladder',
};

/** The tab text: a Qal group says so, the suffix groups do not. */
export function categoryTabLabel(category: Category): string {
  return isQalGroup(category) ? `Qal ${CATEGORY_LABELS[category]}` : CATEGORY_LABELS[category];
}

/**
 * `verb` is one verb as person × number; `summary` is several verb classes side
 * by side as PGN × class.
 */
export type TableLayout = 'verb' | 'summary';

export interface TableModel extends SharedTableModel<Category> {
  layout: TableLayout;
  /** A line for the select screen: the verb's gloss, or what a summary compares. */
  detail?: string;
  /** The ladder rung this table is (`LadderRung.id`); absent off the ladder. */
  rung?: string;
}

/** Result of grading a single blank cell. */
export type CellResult = AnswerResult;

// ─── Cell identity ────────────────────────────────────────────────────────────

/**
 * A form's identity across every table it appears in: `<paradigm>:<key>`,
 * where the key is a PGN, a participle's gender-number or `inf`. SRS cards and
 * the attempt log are keyed by it, so neither part may ever be renamed.
 */
export function cellId(paradigmId: string, key: FormKey): string {
  return `${paradigmId}:${key}`;
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

/**
 * "קטל (strong)" — or just the root, for a verb that is its own class.
 *
 * Only a class named by an ordinary word is lowercased. "III-ה" is a numeral,
 * and lowercased it reads "iii-ה".
 */
function verbLabel(p: VerbParadigm): string {
  const className = VERB_CLASS_LABELS[p.verbClass];
  if (className === p.root) return p.root;
  return `${p.root} (${/^[A-Z][a-z]+$/.test(className) ? className.toLowerCase() : className})`;
}

/**
 * One finite verb as person × number: rows 3m–1c, columns Singular and Plural.
 * A row the conjugation has no form for is left out, so the imperative is its
 * two second-person rows.
 */
export function buildVerbTable(paradigm: VerbParadigm): TableModel {
  const personRows = PERSON_ROWS.filter((row) =>
    [row.singular, ...row.plural].some((pgn) => paradigm.forms[pgn] !== undefined),
  );
  const rows: TableRow[] = personRows.map((row) => {
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
    category: groupOf(paradigm.conjugation),
    layout: 'verb',
    detail: `“${paradigm.gloss}”`,
    cols: ['Singular', 'Plural'],
    rows,
  };
}

/**
 * Verb classes side by side: rows are the conjugation's PGNs in textbook
 * order, one column per class. Undefined when fewer than two classes have the
 * conjugation — a one-column summary is just the verb table over again.
 */
export function buildSummaryTable(conjugation: FiniteConjugation): TableModel | undefined {
  const paradigms = SUMMARY_CLASSES.map((verbClass) =>
    paradigmsFor(conjugation).find((p) => p.verbClass === verbClass),
  ).filter((p): p is VerbParadigm => p !== undefined);
  if (paradigms.length < 2) return undefined;

  return {
    id: `${paradigms[0].stem}-${conjugation}-summary`,
    label: `${conjugationLabel(paradigms[0])} — summary`,
    category: conjugation,
    layout: 'summary',
    detail: 'All classes side by side',
    cols: paradigms.map((p) => `${VERB_CLASS_LABELS[p.verbClass]} (${p.root})`),
    rows: CONJUGATION_KEYS[conjugation].map((pgn) => ({
      label: pgn,
      answers: paradigms.map((p) => formAt(p, pgn)),
      ids: paradigms.map((p) => (p.forms[pgn] ? cellId(p.id, pgn) : null)),
    })),
  };
}

function formAt(paradigm: VerbParadigm, pgn: FormKey | undefined): string | null {
  const form = pgn ? paradigm.forms[pgn] : undefined;
  return form ? answerForm(form) : null;
}

/** One model noun with its ten suffixes, as owner person × number. */
export function buildSuffixTable(paradigm: SuffixParadigm): TableModel {
  const rows: TableRow[] = PERSON_ROWS.map((row) => {
    const pgns = [row.singular, row.plural[0]] as SuffixPgn[];
    return {
      label: row.label,
      answers: pgns.map((pgn) => answerForm(paradigm.forms[pgn])),
      ids: pgns.map((pgn) => cellId(paradigm.id, pgn)),
    };
  });
  return {
    id: paradigm.id,
    label: `${SUFFIX_SET_LABELS[paradigm.set]} — ${paradigm.lemma}`,
    category: 'suffixes',
    layout: 'verb',
    detail: `“${paradigm.gloss}” · ${paradigm.shape}`,
    cols: ['Singular', 'Plural'],
    rows,
  };
}

/**
 * The seven stems by name, with their qatal 3ms on פעל and on קטל (Table 20.1).
 * The stem's name is the row label and the form is the blank, so filling the
 * table is saying which pattern each name stands for. A cell's id is
 * `stem-pattern-<root>:<stem>`; there is no PGN, because every form is a 3ms.
 */
export function buildStemTable(): TableModel {
  return {
    id: 'stem-patterns',
    label: 'Stem names — qatal 3ms patterns',
    category: 'stems',
    layout: 'summary',
    detail: `Each stem’s qatal 3ms · ${STEM_PATTERN_SOURCE}`,
    cols: STEM_ROOTS.map((c) => c.root),
    rows: STEM_NAMES.map((stem) => ({
      label: STEM_NAME_LABELS[stem],
      answers: STEM_ROOTS.map((c) => answerForm(STEM_PATTERNS[c.id][stem])),
      ids: STEM_ROOTS.map((c) => `${stemColumnId(c.id)}:${stem}`),
    })),
  };
}

/** The model nouns side by side, one column each, a row per suffix. */
export function buildSuffixSummaryTable(): TableModel {
  return {
    id: 'suffix-summary',
    label: 'Pronominal suffixes — summary',
    category: 'suffixes',
    layout: 'summary',
    detail: 'Type 1 and Type 2 side by side',
    cols: suffixParadigms.map((p) => p.lemma),
    rows: SUFFIX_PGNS.map((pgn) => ({
      label: pgn,
      answers: suffixParadigms.map((p) => answerForm(p.forms[pgn])),
      ids: suffixParadigms.map((p) => cellId(p.id, pgn)),
    })),
  };
}

/**
 * One ladder rung as a table: a row per suffix PGN, a column per paradigm on
 * the rung. Cell ids come from each column's paradigm, so a form keeps one SRS
 * card wherever it is answered.
 */
export function buildLadderTable(rung: LadderRung, index: number): TableModel {
  return {
    id: `ladder-${rung.id}`,
    label: `Rung ${index + 1} — ${rung.title}`,
    category: 'ladder',
    layout: 'summary',
    detail: rung.detail,
    rung: rung.id,
    cols: rung.columns.map((c) => c.label),
    rows: SUFFIX_PGNS.map((pgn) => ({
      label: pgn,
      answers: rung.columns.map((c) => answerForm(c.forms[pgn])),
      ids: rung.columns.map((c) => cellId(c.id, pgn)),
    })),
  };
}

/**
 * The infinitives or the participles as one table: the Grammar Reference's
 * grid (`qalGrid`), with every column's verb named in its header.
 */
export function buildGridTable(group: 'infinitives' | 'participles'): TableModel {
  const grid = qalGrid(group);
  return {
    id: `qal-${group}`,
    label: `Qal ${CATEGORY_LABELS[group]}`,
    category: group,
    layout: 'summary',
    detail: group === 'infinitives' ? 'Construct and absolute' : 'Active and passive',
    cols: grid.columns.map(
      ({ paradigm, heading }) =>
        `${heading ? `${heading} · ` : ''}${VERB_CLASS_LABELS[paradigm.verbClass]} (${paradigm.root})`,
    ),
    rows: grid.rows.map((row) => ({
      label: row.label,
      answers: row.cells.map((cell) => (cell ? formAt(cell.paradigm, cell.key) : null)),
      ids: row.cells.map((cell) =>
        cell && cell.paradigm.forms[cell.key] ? cellId(cell.paradigm.id, cell.key) : null,
      ),
    })),
  };
}

/**
 * Build all available TableModels: each finite Qal conjugation's summary, then
 * its verbs; the infinitives and the participles as one table each; then the
 * stem names; then suffixes; then the ladder, in rung order.
 */
export function buildTableModels(): TableModel[] {
  const verbTables = QAL_GROUPS.flatMap((group) => {
    if (group === 'infinitives' || group === 'participles') return [buildGridTable(group)];
    const summary = buildSummaryTable(group);
    const verbs = verbParadigms.filter((p) => p.conjugation === group).map(buildVerbTable);
    return summary ? [summary, ...verbs] : verbs;
  });
  return [
    ...verbTables,
    buildStemTable(),
    buildSuffixSummaryTable(),
    ...suffixParadigms.map(buildSuffixTable),
    ...ladderRungs.map(buildLadderTable),
  ];
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
