import { describe, expect, it } from 'vitest';
import { getParadigm, type VerbParadigm, verbParadigms } from '../data/verb-paradigms';
import {
  ALL_CATEGORIES,
  buildSummaryTable,
  buildTableModels,
  buildVerbTable,
  CATEGORY_LABELS,
  cellId,
  countsAsCorrect,
  getQuizCells,
  gradeCell,
} from './paradigm-quiz';

function paradigm(id: string): VerbParadigm {
  const found = getParadigm(id);
  if (!found) throw new Error(`no paradigm ${id}`);
  return found;
}

describe('buildVerbTable', () => {
  it('lays a yiqtol out as five persons by singular and plural', () => {
    const table = buildVerbTable(paradigm('qal-yiqtol-strong'));

    expect(table.cols).toEqual(['Singular', 'Plural']);
    expect(table.rows.map((r) => r.label)).toEqual(['3m', '3f', '2m', '2f', '1c']);
    expect(table.rows[0].answers).toEqual(['יִקְטֹל', 'יִקְטְלוּ']);
    expect(table.rows[1].answers).toEqual(['תִּקְטֹל', 'תִּקְטֹלְנָה']);
    expect(getQuizCells(table)).toHaveLength(10);
  });

  it('puts the qatal 3cp against the 3m row and leaves the 3f plural empty', () => {
    // As Table 10.8 prints it: one common plural, not two cells saying the same thing.
    const table = buildVerbTable(paradigm('qal-qatal-hayah'));

    expect(table.rows[0].answers).toEqual(['הָיָה', 'הָיוּ']);
    expect(table.rows[0].ids).toEqual(['qal-qatal-hayah:3ms', 'qal-qatal-hayah:3cp']);
    expect(table.rows[1].answers).toEqual(['הָיְתָה', null]);
    expect(table.rows[1].ids?.[1]).toBeNull();
    expect(getQuizCells(table)).toHaveLength(9);
  });

  it('gives answers without the stress mark, since nobody types one', () => {
    const table = buildVerbTable(paradigm('qal-qatal-strong'));
    const answers = table.rows.flatMap((r) => r.answers).filter((a) => a !== null);

    expect(answers).toContain('קָטַלְתָּ');
    expect(answers.join('')).not.toContain('֫');
  });

  it('labels the table with stem, conjugation, root and class', () => {
    expect(buildVerbTable(paradigm('qal-qatal-begadkephat')).label).toBe(
      'Qal Qatal (Perfect) — כתב (begadkephat)',
    );
    // היה is its own class, so the class adds nothing to the root.
    expect(buildVerbTable(paradigm('qal-yiqtol-hayah')).label).toBe('Qal Yiqtol (Imperfect) — היה');
  });
});

describe('buildSummaryTable', () => {
  it('sets the three classes side by side in the textbook order', () => {
    const table = buildSummaryTable('qatal');

    expect(table?.cols).toEqual(['Strong (קטל)', 'Begadkephat (כתב)', 'III-ה (בנה)']);
    expect(table?.rows.map((r) => r.label)).toEqual([
      '3ms',
      '3fs',
      '2ms',
      '2fs',
      '1cs',
      '3cp',
      '2mp',
      '2fp',
      '1cp',
    ]);
    expect(table?.rows[0].answers).toEqual(['קָטַל', 'כָּתַב', 'בָּנָה']);
  });

  it('includes only the classes that have the conjugation', () => {
    expect(buildSummaryTable('wayyiqtol')?.cols).toEqual(['Strong (קטל)', 'III-ה (בנה)']);
  });

  it('leaves היה out, as the textbook summaries do', () => {
    const cols = buildSummaryTable('yiqtol')?.cols ?? [];

    expect(cols.some((c) => c.includes('היה'))).toBe(false);
  });
});

describe('cell identity', () => {
  it('gives a form the same id in the verb table and in the summary', () => {
    const verb = getQuizCells(buildVerbTable(paradigm('qal-qatal-begadkephat')));
    const summary = getQuizCells(buildSummaryTable('qatal') ?? fail());
    const id = cellId('qal-qatal-begadkephat', '2ms');

    const inVerb = verb.find((c) => c.id === id);
    const inSummary = summary.find((c) => c.id === id);

    expect(inVerb?.answer).toBe('כָּתַבְתָּ');
    expect(inSummary?.answer).toBe(inVerb?.answer);
    // Same form, different place — which is the whole reason for the id.
    expect(inSummary?.index).not.toBe(inVerb?.index);
  });

  it('gives every quiz cell in every table an id', () => {
    for (const table of buildTableModels()) {
      for (const cell of getQuizCells(table)) {
        expect(cell.id, `${table.id} ${cell.index}`).toBeTruthy();
      }
    }
  });
});

function fail(): never {
  throw new Error('expected a table');
}

describe('buildTableModels', () => {
  const tables = buildTableModels();

  it('builds a verb table for every paradigm and a summary per conjugation', () => {
    expect(tables.filter((t) => t.layout === 'verb')).toHaveLength(verbParadigms.length);
    expect(tables.filter((t) => t.layout === 'summary').map((t) => t.category)).toEqual(
      ALL_CATEGORIES,
    );
  });

  it('gives every table a unique id and a labelled category', () => {
    expect(new Set(tables.map((t) => t.id)).size).toBe(tables.length);
    for (const table of tables) expect(CATEGORY_LABELS[table.category]).toBeTruthy();
  });

  it('keeps every row as wide as the header', () => {
    for (const table of tables) {
      for (const row of table.rows) {
        expect(row.answers, table.id).toHaveLength(table.cols.length);
        expect(row.ids, table.id).toHaveLength(table.cols.length);
      }
    }
  });
});

describe('gradeCell', () => {
  it('passes a correctly typed form', () => {
    expect(gradeCell('קָטַלְתָּ', 'קָטַלְתָּ')).toBe('correct');
  });

  it('grades against the stored form even when it carries a stress mark', () => {
    expect(gradeCell('קָטַלְתָּ', 'קָטַ֫לְתָּ')).toBe('correct');
  });

  it('accepts a last letter the keyboard has not yet turned into its final form', () => {
    expect(gradeCell('בְּנִיתֶמ', 'בְּנִיתֶם')).toBe('correct');
  });

  it('separates a missing dagesh from a wrong vowel from a wrong consonant', () => {
    expect(gradeCell('כָתַב', 'כָּתַב')).toBe('dagesh-only');
    expect(gradeCell('כָּתֵב', 'כָּתַב')).toBe('nikud-only');
    expect(gradeCell('קָטַל', 'כָּתַב')).toBe('wrong');
  });

  it('marks an empty cell wrong', () => {
    expect(gradeCell('  ', 'קָטַל')).toBe('wrong');
  });
});

describe('countsAsCorrect', () => {
  it('forgives pointing when lenient and nothing when strict', () => {
    expect(countsAsCorrect('nikud-only', false)).toBe(true);
    expect(countsAsCorrect('dagesh-only', false)).toBe(true);
    expect(countsAsCorrect('nikud-only', true)).toBe(false);
    expect(countsAsCorrect('dagesh-only', true)).toBe(false);
  });

  it('never forgives a wrong consonant and always passes an exact answer', () => {
    expect(countsAsCorrect('wrong', false)).toBe(false);
    expect(countsAsCorrect('correct', true)).toBe(true);
  });
});
