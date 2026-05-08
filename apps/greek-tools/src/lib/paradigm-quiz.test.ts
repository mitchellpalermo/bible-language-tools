/**
 * Tests for src/lib/paradigm-quiz.ts
 *
 * Covers: buildTableModels, getQuizCells, applyDensity,
 * and the category/density utilities.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_CATEGORIES,
  applyDensity,
  buildContractVerbTables,
  buildLiquidVerbTables,
  buildMiVerbTables,
  buildTableModels,
  CATEGORY_LABELS,
  type Density,
  getQuizCells,
} from './paradigm-quiz';

// ---------------------------------------------------------------------------
// buildTableModels
// ---------------------------------------------------------------------------

describe('buildTableModels', () => {
  it('returns models for all five categories', () => {
    const tables = buildTableModels();
    const categories = new Set(tables.map((t) => t.category));
    expect(categories).toContain('noun');
    expect(categories).toContain('adjective');
    expect(categories).toContain('verb');
    expect(categories).toContain('pronoun');
    expect(categories).toContain('article');
  });

  it('all models have required fields', () => {
    const tables = buildTableModels();
    for (const t of tables) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.cols.length).toBeGreaterThan(0);
      expect(t.rows.length).toBeGreaterThan(0);
    }
  });

  it('each row has answers matching the cols count', () => {
    const tables = buildTableModels();
    for (const t of tables) {
      for (const row of t.rows) {
        expect(row.answers).toHaveLength(t.cols.length);
      }
    }
  });

  // ── Nouns ────────────────────────────────────────────────────────────────

  it('includes all 9 noun paradigms', () => {
    const tables = buildTableModels();
    const nouns = tables.filter((t) => t.category === 'noun');
    expect(nouns.length).toBe(9);
  });

  it('noun tables have 2 columns (Singular, Plural)', () => {
    const tables = buildTableModels();
    const nouns = tables.filter((t) => t.category === 'noun');
    for (const noun of nouns) {
      expect(noun.cols).toHaveLength(2);
      expect(noun.cols[0]).toBe('Singular');
      expect(noun.cols[1]).toBe('Plural');
    }
  });

  it('noun tables have 5 rows (cases)', () => {
    const tables = buildTableModels();
    const nouns = tables.filter((t) => t.category === 'noun');
    for (const noun of nouns) {
      expect(noun.rows).toHaveLength(5);
    }
  });

  it('noun tables have no null answers', () => {
    const tables = buildTableModels();
    const nouns = tables.filter((t) => t.category === 'noun');
    for (const noun of nouns) {
      for (const row of noun.rows) {
        expect(row.answers.every((a) => a !== null)).toBe(true);
      }
    }
  });

  // ── Adjectives ───────────────────────────────────────────────────────────

  it('includes both adjective paradigms', () => {
    const tables = buildTableModels();
    const adjs = tables.filter((t) => t.category === 'adjective');
    expect(adjs.length).toBe(2);
  });

  it('adjective tables have 6 columns (3 genders × 2 numbers)', () => {
    const tables = buildTableModels();
    const adjs = tables.filter((t) => t.category === 'adjective');
    for (const adj of adjs) {
      expect(adj.cols).toHaveLength(6);
      expect(adj.colGroups).toHaveLength(2);
    }
  });

  it('adjective tables have 5 rows (cases)', () => {
    const tables = buildTableModels();
    const adjs = tables.filter((t) => t.category === 'adjective');
    for (const adj of adjs) {
      expect(adj.rows).toHaveLength(5);
    }
  });

  // ── Verbs ────────────────────────────────────────────────────────────────

  it('includes verb paradigms including infinitives and participle declension tables', () => {
    const tables = buildTableModels();
    const verbs = tables.filter((t) => t.category === 'verb');
    const ids = verbs.map((v) => v.id);
    expect(ids).toContain('verb-infinitives');
    expect(ids).toContain('participle-pres-act-ptc');
    expect(ids).toContain('participle-aor-pass-ptc');
    expect(ids).toContain('participle-perf-mid-pass-ptc');
  });

  it('verb conjugation tables have 1 column (Form)', () => {
    const tables = buildTableModels();
    const particleIds = tables.filter((t) => t.id.startsWith('participle-')).map((t) => t.id);
    const conj = tables.filter(
      (t) => t.category === 'verb' && t.id !== 'verb-infinitives' && !particleIds.includes(t.id),
    );
    for (const v of conj) {
      expect(v.cols).toHaveLength(1);
      expect(v.cols[0]).toBe('Form');
    }
  });

  it('participle tables have 6 leaf columns (Sg M/F/N + Pl M/F/N)', () => {
    const tables = buildTableModels();
    const participles = tables.filter((t) => t.id.startsWith('participle-'));
    expect(participles).toHaveLength(10);
    for (const p of participles) {
      expect(p.cols).toHaveLength(6);
      expect(p.rows).toHaveLength(5); // 5 cases
    }
  });

  it('imperative paradigms have null answers for missing person-numbers', () => {
    const tables = buildTableModels();
    const impv = tables.find((t) => t.id === 'verb-pres-act-imp');
    // Imperative has no 1sg or 1pl — row for 1sg should have null or the row is excluded
    // (our implementation filters rows where 1sg/1pl is null for imperative)
    if (impv) {
      const allAnswers = impv.rows.flatMap((r) => r.answers);
      // At most 4 non-null answers (2sg, 3sg, 2pl, 3pl)
      const nonNull = allAnswers.filter((a) => a !== null);
      expect(nonNull.length).toBeLessThanOrEqual(4);
    }
  });

  // ── Pronouns ─────────────────────────────────────────────────────────────

  it('includes pronouns for ἐγώ and σύ', () => {
    const tables = buildTableModels();
    const pronouns = tables.filter((t) => t.category === 'pronoun');
    const ids = pronouns.map((p) => p.id);
    expect(ids).toContain('pronoun-ego');
    expect(ids).toContain('pronoun-su');
  });

  it('includes gendered pronouns (αὐτός, οὗτος, ἐκεῖνος, ὅς, τίς)', () => {
    const tables = buildTableModels();
    const pronounIds = tables.filter((t) => t.category === 'pronoun').map((t) => t.id);
    expect(pronounIds).toContain('pronoun-autos');
    expect(pronounIds).toContain('pronoun-outos');
    expect(pronounIds).toContain('pronoun-ekeinos');
    expect(pronounIds).toContain('pronoun-hos');
    expect(pronounIds).toContain('pronoun-tis');
  });

  it('personal pronoun tables have 2 columns (Singular, Plural)', () => {
    const tables = buildTableModels();
    const ego = tables.find((t) => t.id === 'pronoun-ego')!;
    expect(ego.cols).toHaveLength(2);
  });

  it('gendered pronoun tables have 6 columns and col groups', () => {
    const tables = buildTableModels();
    const autos = tables.find((t) => t.id === 'pronoun-autos')!;
    expect(autos.cols).toHaveLength(6);
    expect(autos.colGroups).toHaveLength(2);
  });

  // ── Definite Article ─────────────────────────────────────────────────────

  it('includes exactly one article table', () => {
    const tables = buildTableModels();
    const articles = tables.filter((t) => t.category === 'article');
    expect(articles).toHaveLength(1);
    expect(articles[0].id).toBe('article');
  });

  it('article table has 6 columns (3 genders × 2 numbers)', () => {
    const tables = buildTableModels();
    const article = tables.find((t) => t.id === 'article')!;
    expect(article.cols).toHaveLength(6);
    expect(article.colGroups).toHaveLength(2);
  });

  it('article table has 4 rows (Nom, Gen, Dat, Acc — no Voc)', () => {
    const tables = buildTableModels();
    const article = tables.find((t) => t.id === 'article')!;
    expect(article.rows).toHaveLength(4);
    const rowLabels = article.rows.map((r) => r.label);
    expect(rowLabels).toContain('Nom');
    expect(rowLabels).toContain('Gen');
    expect(rowLabels).toContain('Dat');
    expect(rowLabels).toContain('Acc');
    expect(rowLabels).not.toContain('Voc');
  });

  it('article table nom sg masc is ὁ (first answer of first row)', () => {
    const tables = buildTableModels();
    const article = tables.find((t) => t.id === 'article')!;
    // First row = Nom, first answer = sg masc
    expect(article.rows[0].answers[0]).toBe('ὁ');
  });

  it('article table has no null answers (all 24 cells populated)', () => {
    const tables = buildTableModels();
    const article = tables.find((t) => t.id === 'article')!;
    const allAnswers = article.rows.flatMap((r) => r.answers);
    expect(allAnswers).toHaveLength(24);
    expect(allAnswers.every((a) => a !== null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getQuizCells
// ---------------------------------------------------------------------------

describe('getQuizCells', () => {
  it('returns one cell per non-null answer', () => {
    const tables = buildTableModels();
    const noun = tables.find((t) => t.category === 'noun')!;
    const cells = getQuizCells(noun);
    // 5 cases × 2 numbers = 10 cells
    expect(cells).toHaveLength(10);
  });

  it('cell indices are unique', () => {
    const tables = buildTableModels();
    for (const t of tables) {
      const cells = getQuizCells(t);
      const indices = cells.map((c) => c.index);
      expect(new Set(indices).size).toBe(indices.length);
    }
  });

  it('cells have correct rowIndex and colIndex', () => {
    const tables = buildTableModels();
    const noun = tables.find((t) => t.category === 'noun')!;
    const cells = getQuizCells(noun);
    // First cell: row 0, col 0 (Nom Sg)
    const first = cells[0];
    expect(first.rowIndex).toBe(0);
    expect(first.colIndex).toBe(0);
    // Last cell: row 4, col 1 (Voc Pl)
    const last = cells[cells.length - 1];
    expect(last.rowIndex).toBe(4);
    expect(last.colIndex).toBe(1);
  });

  it('all cells start with isBlank=false', () => {
    const tables = buildTableModels();
    const noun = tables.find((t) => t.category === 'noun')!;
    const cells = getQuizCells(noun);
    expect(cells.every((c) => !c.isBlank)).toBe(true);
  });

  it('cells with null answers are excluded', () => {
    // Imperative paradigm has missing forms (1sg, 1pl)
    const tables = buildTableModels();
    const impv = tables.find((t) => t.id === 'verb-pres-act-imp');
    if (impv) {
      const cells = getQuizCells(impv);
      expect(cells.every((c) => c.answer !== null)).toBe(true);
    }
  });

  it('cell.answer matches the table data', () => {
    const tables = buildTableModels();
    const noun = tables.find((t) => t.id === 'noun-1f-alpha-pure')!;
    const cells = getQuizCells(noun);
    // Nom Sg of ἡμέρα is ἡμέρα
    const nomSg = cells.find((c) => c.rowIndex === 0 && c.colIndex === 0)!;
    expect(nomSg.answer).toBe('ἡμέρα');
    // Gen Pl of ἡμέρα is ἡμερῶν
    const genPl = cells.find((c) => c.rowIndex === 1 && c.colIndex === 1)!;
    expect(genPl.answer).toBe('ἡμερῶν');
  });
});

// ---------------------------------------------------------------------------
// applyDensity
// ---------------------------------------------------------------------------

describe('applyDensity', () => {
  function makeCells(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      index: i,
      rowIndex: 0,
      colIndex: i,
      answer: `form${i}`,
      isBlank: false,
    }));
  }

  it('easy mode blanks ~25% of cells', () => {
    const cells = makeCells(20);
    const result = applyDensity(cells, 'easy');
    const blanked = result.filter((c) => c.isBlank).length;
    expect(blanked).toBe(5); // 20 * 0.25 = 5
  });

  it('medium mode blanks ~50% of cells', () => {
    const cells = makeCells(20);
    const result = applyDensity(cells, 'medium');
    const blanked = result.filter((c) => c.isBlank).length;
    expect(blanked).toBe(10);
  });

  it('hard mode blanks all cells', () => {
    const cells = makeCells(10);
    const result = applyDensity(cells, 'hard');
    expect(result.every((c) => c.isBlank)).toBe(true);
  });

  it('always blanks at least 1 cell', () => {
    const cells = makeCells(1);
    const densities: Density[] = ['easy', 'medium', 'hard'];
    for (const d of densities) {
      const result = applyDensity(cells, d);
      expect(result.filter((c) => c.isBlank).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('does not modify non-blank cells', () => {
    const cells = makeCells(10);
    const result = applyDensity(cells, 'medium');
    // All cells should still be present
    expect(result).toHaveLength(10);
    // Answers should be unchanged
    result.forEach((c, i) => {
      expect(c.answer).toBe(cells[i].answer);
      expect(c.index).toBe(cells[i].index);
    });
  });

  it('returns a new array (does not mutate input)', () => {
    const cells = makeCells(10);
    const result = applyDensity(cells, 'medium');
    // Original cells should all still have isBlank=false
    expect(cells.every((c) => !c.isBlank)).toBe(true);
    // Result should have some blanks
    expect(result.some((c) => c.isBlank)).toBe(true);
  });

  it('blank selection is random (different results across calls)', () => {
    const cells = makeCells(10);
    const runs = Array.from({ length: 10 }, () =>
      applyDensity(cells, 'medium')
        .filter((c) => c.isBlank)
        .map((c) => c.index)
        .join(','),
    );
    // At least 2 unique blank patterns across 10 runs (probabilistic)
    const unique = new Set(runs);
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Category utilities
// ---------------------------------------------------------------------------

describe('ALL_CATEGORIES', () => {
  it('contains all five categories', () => {
    expect(ALL_CATEGORIES).toContain('noun');
    expect(ALL_CATEGORIES).toContain('adjective');
    expect(ALL_CATEGORIES).toContain('verb');
    expect(ALL_CATEGORIES).toContain('pronoun');
    expect(ALL_CATEGORIES).toContain('article');
    expect(ALL_CATEGORIES).toHaveLength(5);
  });
});

describe('CATEGORY_LABELS', () => {
  it('has a label for every category', () => {
    for (const cat of ALL_CATEGORIES) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// buildContractVerbTables
// ---------------------------------------------------------------------------

describe('buildContractVerbTables', () => {
  it('returns 12 tables (4 paradigms × 3 contract types)', () => {
    const tables = buildContractVerbTables();
    expect(tables).toHaveLength(12);
  });

  it('all tables have category "verb"', () => {
    const tables = buildContractVerbTables();
    expect(tables.every((t) => t.category === 'verb')).toBe(true);
  });

  it('all tables have ids prefixed with "contract-"', () => {
    const tables = buildContractVerbTables();
    expect(tables.every((t) => t.id.startsWith('contract-'))).toBe(true);
  });

  it('all tables have 1 column (Form)', () => {
    const tables = buildContractVerbTables();
    for (const t of tables) {
      expect(t.cols).toHaveLength(1);
      expect(t.cols[0]).toBe('Form');
    }
  });

  it('all tables have 6 rows (one per person-number)', () => {
    const tables = buildContractVerbTables();
    for (const t of tables) {
      expect(t.rows).toHaveLength(6);
    }
  });

  it('α-contract pres act ind 1sg is ἀγαπῶ', () => {
    const tables = buildContractVerbTables();
    const table = tables.find((t) => t.id === 'contract-alpha-pres-act-ind')!;
    expect(table).toBeDefined();
    expect(table.rows[0].answers[0]).toBe('ἀγαπῶ');
  });

  it('ε-contract pres act ind 2pl is ποιεῖτε', () => {
    const tables = buildContractVerbTables();
    const table = tables.find((t) => t.id === 'contract-epsilon-pres-act-ind')!;
    expect(table).toBeDefined();
    // 2pl is index 4 in PERSONS order: 1sg, 2sg, 3sg, 1pl, 2pl, 3pl
    expect(table.rows[4].answers[0]).toBe('ποιεῖτε');
  });

  it('ο-contract impf act ind 3sg is ἐπλήρου', () => {
    const tables = buildContractVerbTables();
    const table = tables.find((t) => t.id === 'contract-omicron-impf-act-ind')!;
    expect(table).toBeDefined();
    // 3sg is index 2
    expect(table.rows[2].answers[0]).toBe('ἐπλήρου');
  });

  it('labels include the contract type identifier', () => {
    const tables = buildContractVerbTables();
    const alphaTable = tables.find((t) => t.id.startsWith('contract-alpha'))!;
    expect(alphaTable.label).toContain('ἀγαπάω');
    const epsilonTable = tables.find((t) => t.id.startsWith('contract-epsilon'))!;
    expect(epsilonTable.label).toContain('ποιέω');
    const omicronTable = tables.find((t) => t.id.startsWith('contract-omicron'))!;
    expect(omicronTable.label).toContain('πληρόω');
  });

  it('each row has answers matching the cols count', () => {
    const tables = buildContractVerbTables();
    for (const t of tables) {
      for (const row of t.rows) {
        expect(row.answers).toHaveLength(t.cols.length);
      }
    }
  });

  it('contract verb tables are excluded from buildTableModels', () => {
    const all = buildTableModels();
    const contractIds = all.filter((t) => t.id.startsWith('contract-'));
    expect(contractIds.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildLiquidVerbTables
// ---------------------------------------------------------------------------

describe('buildLiquidVerbTables', () => {
  it('returns 1 table (liquid future for βαλῶ)', () => {
    const tables = buildLiquidVerbTables();
    expect(tables).toHaveLength(1);
  });

  it('table has id "liquid-future-ballo"', () => {
    const tables = buildLiquidVerbTables();
    expect(tables[0].id).toBe('liquid-future-ballo');
  });

  it('table has category "verb"', () => {
    const tables = buildLiquidVerbTables();
    expect(tables[0].category).toBe('verb');
  });

  it('table has 6 rows (one per person-number)', () => {
    const tables = buildLiquidVerbTables();
    expect(tables[0].rows).toHaveLength(6);
  });

  it('1sg form is βαλῶ', () => {
    const tables = buildLiquidVerbTables();
    expect(tables[0].rows[0].answers[0]).toBe('βαλῶ');
  });

  it('2sg form is βαλεῖς', () => {
    const tables = buildLiquidVerbTables();
    expect(tables[0].rows[1].answers[0]).toBe('βαλεῖς');
  });

  it('3pl form is βαλοῦσι(ν)', () => {
    const tables = buildLiquidVerbTables();
    expect(tables[0].rows[5].answers[0]).toBe('βαλοῦσι(ν)');
  });

  it('liquid verb table is excluded from buildTableModels', () => {
    const all = buildTableModels();
    const liquid = all.find((t) => t.id === 'liquid-future-ballo');
    expect(liquid).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildMiVerbTables
// ---------------------------------------------------------------------------

describe('buildMiVerbTables', () => {
  it('returns 36 tables (28 conjugation + 4 infinitive + 4 participle)', () => {
    const tables = buildMiVerbTables();
    expect(tables).toHaveLength(36);
  });

  it('all tables have category "verb"', () => {
    const tables = buildMiVerbTables();
    tables.forEach((t) => expect(t.category).toBe('verb'));
  });

  it('all table ids are unique', () => {
    const tables = buildMiVerbTables();
    const ids = tables.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all tables have ids prefixed with "mi-"', () => {
    const tables = buildMiVerbTables();
    tables.forEach((t) => expect(t.id.startsWith('mi-')).toBe(true));
  });

  it('conjugation tables have 1 column ("Form")', () => {
    const tables = buildMiVerbTables();
    const conjugationTables = tables.filter(
      (t) => !t.id.endsWith('-infinitives') && !t.id.endsWith('-participles'),
    );
    conjugationTables.forEach((t) => {
      expect(t.cols).toEqual(['Form']);
    });
  });

  it('conjugation tables for indicatives have 6 rows', () => {
    const tables = buildMiVerbTables();
    const indicatives = tables.filter(
      (t) => t.id.includes('-pres-ind') || t.id.includes('-impf-ind') || t.id.includes('-aor-ind'),
    );
    indicatives.forEach((t) => expect(t.rows).toHaveLength(6));
  });

  it('conjugation tables for imperatives have 4 rows (no 1sg/1pl)', () => {
    const tables = buildMiVerbTables();
    const imperatives = tables.filter(
      (t) => t.id.includes('-pres-imptv') || t.id.includes('-aor-imptv'),
    );
    imperatives.forEach((t) => expect(t.rows).toHaveLength(4));
  });

  it('infinitive tables have 2 rows and 1 column', () => {
    const tables = buildMiVerbTables();
    const infTables = tables.filter((t) => t.id.endsWith('-infinitives'));
    expect(infTables).toHaveLength(4);
    infTables.forEach((t) => {
      expect(t.rows).toHaveLength(2);
      expect(t.cols).toEqual(['Form']);
    });
  });

  it('participle tables have 2 rows and 3 columns (Masc./Fem./Neut.)', () => {
    const tables = buildMiVerbTables();
    const ptcTables = tables.filter((t) => t.id.endsWith('-participles'));
    expect(ptcTables).toHaveLength(4);
    ptcTables.forEach((t) => {
      expect(t.rows).toHaveLength(2);
      expect(t.cols).toEqual(['Masc.', 'Fem.', 'Neut.']);
    });
  });

  it('δίδωμι present indicative 1sg is δίδωμι', () => {
    const tables = buildMiVerbTables();
    const table = tables.find((t) => t.id === 'mi-didomi-pres-ind')!;
    expect(table).toBeDefined();
    expect(table.rows[0].answers[0]).toBe('δίδωμι');
  });

  it('δίδωμι aorist indicative 1sg is ἔδωκα', () => {
    const tables = buildMiVerbTables();
    const table = tables.find((t) => t.id === 'mi-didomi-aor-ind')!;
    expect(table.rows[0].answers[0]).toBe('ἔδωκα');
  });

  it('ἀφίημι aorist imperative 2sg is ἄφες', () => {
    const tables = buildMiVerbTables();
    const table = tables.find((t) => t.id === 'mi-aphiemi-aor-imptv')!;
    // Rows are filtered to non-null forms; 2sg is first (1sg filtered out)
    expect(table.rows[0].answers[0]).toBe('ἄφες');
  });

  it('τίθημι infinitive table includes θεῖναι', () => {
    const tables = buildMiVerbTables();
    const table = tables.find((t) => t.id === 'mi-tithemi-infinitives')!;
    const forms = table.rows.map((r) => r.answers[0]);
    expect(forms).toContain('θεῖναι');
  });

  it('ἵστημι participle table nom sg masc is ἱστάς (present)', () => {
    const tables = buildMiVerbTables();
    const table = tables.find((t) => t.id === 'mi-histemi-participles')!;
    expect(table.rows[0].answers[0]).toBe('ἱστάς');
  });

  it('μι-verb tables are excluded from buildTableModels', () => {
    const all = buildTableModels();
    const miTables = all.filter((t) => t.id.startsWith('mi-'));
    expect(miTables).toHaveLength(0);
  });
});
