/**
 * Paradigm Quiz — data model and game logic.
 *
 * Converts raw grammar data (nounParadigms, verbParadigms, etc.) into a
 * unified TableModel structure, then manages which cells are blanked and
 * how to score the student's answers.
 */

import {
  adjParadigms,
  articleForms,
  CASE_LABELS,
  CASES,
  contractVerbParadigms,
  GENDER_LABELS,
  GENDERS,
  genderedPronouns,
  infinitiveForms,
  liquidFutureComparison,
  miVerbEntries,
  miVerbParadigms,
  NUM_LABELS,
  NUMBERS,
  nounParadigms,
  PERSON_LABELS,
  PERSONS,
  participleParadigms,
  personalPronouns12,
  verbParadigms,
} from '../data/grammar';

// The table model and the blanking logic are shared with hebrew-tools; what is
// Greek about this file is which tables exist and how they are built.
export {
  applyDensity,
  type Density,
  getQuizCells,
  type QuizCell,
  type TableRow,
} from '@tools/shared/paradigm-quiz';

import type { TableModel as SharedTableModel } from '@tools/shared/paradigm-quiz';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A Greek paradigm table: the shared model, narrowed to this app's categories. */
export type TableModel = SharedTableModel<Category>;

/** Result of grading a single blank cell. */
export type CellResult = 'correct' | 'accent-only' | 'wrong';

// ---------------------------------------------------------------------------
// Table builders
// ---------------------------------------------------------------------------

/** Build all available TableModels from grammar data. */
export function buildTableModels(): TableModel[] {
  return [
    ...buildNounTables(),
    ...buildAdjTables(),
    ...buildVerbTables(),
    // Contract verb and liquid verb tables excluded for now
    // ...buildContractVerbTables(),
    // ...buildLiquidVerbTables(),
    ...buildPronounTables(),
    buildArticleTable(),
  ];
}

/** Noun paradigms: rows = cases, cols = [Singular, Plural]. */
function buildNounTables(): TableModel[] {
  return nounParadigms.map((p) => ({
    id: `noun-${p.id}`,
    label: p.name,
    category: 'noun' as const,
    cols: NUMBERS.map((n) => NUM_LABELS[n]),
    rows: CASES.map((c) => ({
      label: CASE_LABELS[c],
      answers: NUMBERS.map((n) => p.forms[c][n].full),
    })),
  }));
}

/**
 * Adjective paradigms: rows = cases, col groups = [Singular, Plural],
 * leaf cols = [Masc., Fem., Neut.] repeated per group.
 */
function buildAdjTables(): TableModel[] {
  return adjParadigms.map((p) => ({
    id: `adj-${p.id}`,
    label: p.name,
    category: 'adjective' as const,
    colGroups: NUMBERS.map((n) => NUM_LABELS[n]),
    cols: NUMBERS.flatMap(() => GENDERS.map((g) => GENDER_LABELS[g])),
    rows: CASES.map((c) => ({
      label: CASE_LABELS[c],
      answers: NUMBERS.flatMap((n) => GENDERS.map((g) => p.forms[c][n][g])),
    })),
  }));
}

/**
 * Verb paradigms: one table per VerbParadigm entry, plus two combined tables
 * for infinitives and participles.
 */
function buildVerbTables(): TableModel[] {
  const conjugationTables: TableModel[] = verbParadigms.map((p) => ({
    id: `verb-${p.id}`,
    label: p.label,
    category: 'verb' as const,
    cols: ['Form'],
    rows: PERSONS.map((pn) => ({
      label: PERSON_LABELS[pn],
      answers: [p.forms[pn] ?? null],
    })).filter((row) => row.answers[0] !== null || p.group !== 'imperative'),
  }));

  const infinitiveTable: TableModel = {
    id: 'verb-infinitives',
    label: 'Infinitives (λύω)',
    category: 'verb',
    cols: ['Form'],
    rows: infinitiveForms.map((inf) => ({
      label: inf.label,
      answers: [inf.form],
    })),
  };

  const participleTables = buildParticipleParadigmTables();

  return [...conjugationTables, infinitiveTable, ...participleTables];
}

/**
 * Participle paradigms: one table per tense-voice combination, rows = cases,
 * col groups = [Singular, Plural], leaf cols = [Masc., Fem., Neut.].
 * Mirrors the adjective table structure.
 */
function buildParticipleParadigmTables(): TableModel[] {
  return participleParadigms.map((p) => ({
    id: `participle-${p.id}`,
    label: `${p.label} Participle (λύω)`,
    category: 'verb' as const,
    colGroups: NUMBERS.map((n) => NUM_LABELS[n]),
    cols: NUMBERS.flatMap(() => GENDERS.map((g) => GENDER_LABELS[g])),
    rows: CASES.map((c) => ({
      label: CASE_LABELS[c],
      answers: NUMBERS.flatMap((n) => GENDERS.map((g) => p.forms[c][n][g])),
    })),
  }));
}

/**
 * Pronoun paradigms:
 * - 1st/2nd person: rows = cases, cols = [Singular, Plural]
 * - Gendered pronouns: rows = cases, col groups = [Singular, Plural],
 *   leaf cols = [Masc., Fem., Neut.]
 */
function buildPronounTables(): TableModel[] {
  const personal: TableModel[] = personalPronouns12.map((p) => ({
    id: `pronoun-${p.id}`,
    label: p.name,
    category: 'pronoun' as const,
    cols: NUMBERS.map((n) => NUM_LABELS[n]),
    rows: CASES.filter((c) => c !== 'voc').map((c) => ({
      label: CASE_LABELS[c],
      answers: NUMBERS.map((n) => p.forms[n][c] ?? null),
    })),
  }));

  const gendered: TableModel[] = genderedPronouns.map((p) => ({
    id: `pronoun-${p.id}`,
    label: p.name,
    category: 'pronoun' as const,
    colGroups: NUMBERS.map((n) => NUM_LABELS[n]),
    cols: NUMBERS.flatMap(() => GENDERS.map((g) => GENDER_LABELS[g])),
    rows: CASES.filter((c) => p.forms[c] !== undefined).map((c) => ({
      label: CASE_LABELS[c],
      answers: NUMBERS.flatMap((n) => GENDERS.map((g) => p.forms[c]?.[n]?.[g] ?? null)),
    })),
  }));

  return [...personal, ...gendered];
}

/**
 * Contract verb paradigms: one table per paradigm, rows = persons, col = contracted form.
 * Labelled with the contract type so students know which pattern they're drilling.
 */
export function buildContractVerbTables(): TableModel[] {
  const typeLabel: Record<string, string> = {
    alpha: 'α-contract (ἀγαπάω)',
    epsilon: 'ε-contract (ποιέω)',
    omicron: 'ο-contract (πληρόω)',
  };
  return contractVerbParadigms.map((p) => ({
    id: `contract-${p.id}`,
    label: `${p.label} — ${typeLabel[p.contractType]}`,
    category: 'verb' as const,
    cols: ['Form'],
    rows: PERSONS.map((pn) => ({
      label: PERSON_LABELS[pn],
      answers: [p.forms[pn] ?? null],
    })),
  }));
}

/**
 * μι-verb tables: one conjugation table per paradigm (all four verbs × all tense-mood combos),
 * plus one infinitive table and one participle nom-sg table per verb.
 * Excluded from buildTableModels() — opt-in via this export.
 */
export function buildMiVerbTables(): TableModel[] {
  const conjugationTables: TableModel[] = miVerbParadigms.map((p) => {
    const entry = miVerbEntries.find((e) => e.id === p.verbId)!;
    return {
      id: `mi-${p.id}`,
      label: `${entry.lexical} — ${p.label}`,
      category: 'verb' as const,
      cols: ['Form'],
      rows: PERSONS.map((pn) => ({
        label: PERSON_LABELS[pn],
        answers: [p.forms[pn] ?? null],
      })).filter((row) => row.answers[0] !== null),
    };
  });

  const infinitiveTables: TableModel[] = miVerbEntries.map((entry) => ({
    id: `mi-${entry.id}-infinitives`,
    label: `${entry.lexical} — Infinitives`,
    category: 'verb' as const,
    cols: ['Form'],
    rows: entry.infinitives.map((inf) => ({
      label: inf.label,
      answers: [inf.form],
    })),
  }));

  const participleTables: TableModel[] = miVerbEntries.map((entry) => ({
    id: `mi-${entry.id}-participles`,
    label: `${entry.lexical} — Participle Nom Sg`,
    category: 'verb' as const,
    colGroups: undefined,
    cols: ['Masc.', 'Fem.', 'Neut.'],
    rows: entry.participleNomSg.map((row) => ({
      label: row.label,
      answers: [row.m, row.f, row.n],
    })),
  }));

  return [...conjugationTables, ...infinitiveTables, ...participleTables];
}

/**
 * Liquid verb table: the future active of βαλῶ as a single quiz-able paradigm.
 */
export function buildLiquidVerbTables(): TableModel[] {
  return [
    {
      id: 'liquid-future-ballo',
      label: 'Liquid Future Active — βαλῶ (βάλλω)',
      category: 'verb' as const,
      cols: ['Form'],
      rows: liquidFutureComparison.map((row) => ({
        label: PERSON_LABELS[row.person],
        answers: [row.liquid],
      })),
    },
  ];
}

/**
 * Definite article paradigm:
 * rows = cases (Nom, Gen, Dat, Acc — no Vocative),
 * col groups = Singular | Plural, leaf cols = Masc. | Fem. | Neut.
 */
function buildArticleTable(): TableModel {
  const articleCases = CASES.filter((c) => c !== 'voc');
  return {
    id: 'article',
    label: 'Definite Article — ὁ, ἡ, τό',
    category: 'article',
    colGroups: NUMBERS.map((n) => NUM_LABELS[n]),
    cols: NUMBERS.flatMap(() => GENDERS.map((g) => GENDER_LABELS[g])),
    rows: articleCases.map((c) => ({
      label: CASE_LABELS[c],
      answers: NUMBERS.flatMap((n) => GENDERS.map((g) => articleForms[c][n][g])),
    })),
  };
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

export type Category = 'noun' | 'adjective' | 'verb' | 'pronoun' | 'article';

export const CATEGORY_LABELS: Record<Category, string> = {
  noun: 'Nouns',
  adjective: 'Adjectives',
  verb: 'Verbs',
  pronoun: 'Pronouns',
  article: 'Definite Article',
};

export const ALL_CATEGORIES: Category[] = ['noun', 'adjective', 'verb', 'pronoun', 'article'];
