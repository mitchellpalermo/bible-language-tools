import { describe, expect, it } from 'vitest';
import { applyDensity, DENSITY_RATIO, getQuizCells, type TableModel } from './paradigm-quiz';

const TABLE: TableModel = {
  id: 'demo',
  label: 'Demo',
  category: 'verb',
  cols: ['Singular', 'Plural'],
  rows: [
    { label: '3m', answers: ['a', 'b'], ids: ['demo:3ms', 'demo:3cp'] },
    { label: '3f', answers: ['c', null], ids: ['demo:3fs', null] },
    { label: '2m', answers: ['d', 'e'] },
  ],
};

/** A deterministic stand-in for Math.random. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('getQuizCells', () => {
  it('skips the cells whose form does not exist', () => {
    const cells = getQuizCells(TABLE);

    expect(cells.map((c) => c.answer)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('indexes a cell by its position in the full grid, gaps included', () => {
    // The 2m row sits after the gap, so its indices must not close up over it —
    // the component addresses inputs by this number.
    const cells = getQuizCells(TABLE);

    expect(cells.map((c) => c.index)).toEqual([0, 1, 2, 4, 5]);
    expect(cells[3]).toMatchObject({ rowIndex: 2, colIndex: 0 });
  });

  it('carries a stable id where the row supplies one, and none where it does not', () => {
    const cells = getQuizCells(TABLE);

    expect(cells[0].id).toBe('demo:3ms');
    expect(cells[1].id).toBe('demo:3cp');
    expect(cells[3]).not.toHaveProperty('id');
  });

  it('starts every cell unblanked', () => {
    expect(getQuizCells(TABLE).every((c) => !c.isBlank)).toBe(true);
  });
});

describe('applyDensity', () => {
  const cells = getQuizCells(TABLE);

  it('blanks every cell on hard', () => {
    expect(applyDensity(cells, 'hard').every((c) => c.isBlank)).toBe(true);
  });

  it('blanks the share of cells the density names', () => {
    for (const density of ['easy', 'medium'] as const) {
      const blanks = applyDensity(cells, density).filter((c) => c.isBlank);
      expect(blanks).toHaveLength(Math.round(cells.length * DENSITY_RATIO[density]));
    }
  });

  it('always blanks at least one cell', () => {
    const one = applyDensity(cells.slice(0, 1), 'easy');

    expect(one[0].isBlank).toBe(true);
  });

  it('chooses the blanks from the random source it is given', () => {
    const first = applyDensity(cells, 'easy', sequence([0]));
    const second = applyDensity(cells, 'easy', sequence([0.99]));

    expect(first.filter((c) => c.isBlank)).not.toEqual(second.filter((c) => c.isBlank));
  });

  it('returns new cells and leaves its input alone', () => {
    applyDensity(cells, 'hard');

    expect(cells.every((c) => !c.isBlank)).toBe(true);
  });
});
