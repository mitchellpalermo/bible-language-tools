import { describe, expect, it } from 'vitest';
import type { CellResult, QuizCell } from './paradigm-quiz';
import {
  LADDER_PROGRESS_KEY,
  ladderNote,
  ladderOutcome,
  loadLadderProgress,
  saveLadderProgress,
} from './suffix-ladder';

const cells = (blank: boolean[]): QuizCell[] =>
  blank.map((isBlank, index) => ({
    index,
    rowIndex: index,
    colIndex: 0,
    answer: 'x',
    isBlank,
  }));

const all = (result: CellResult, n = 3) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [i, result]));

describe('ladderOutcome', () => {
  const full = cells([true, true, true]);

  it('counts an exact full table, and opens the next rung on the second', () => {
    const first = ladderOutcome({}, 'suffixes', full, all('correct'), false);
    expect(first).toMatchObject({ clean: true, progress: { suffixes: 1 }, unlocked: undefined });
    expect(ladderNote(first)).toBe('Clean write: 1 of 2 toward rung 2.');

    const second = ladderOutcome(first.progress, 'suffixes', full, all('correct'), false);
    expect(second).toMatchObject({ progress: { suffixes: 2 }, unlocked: 2 });
    expect(ladderNote(second)).toBe('Clean write. Rung 2 is open.');

    const third = ladderOutcome(second.progress, 'suffixes', full, all('correct'), false);
    expect(ladderNote(third)).toBe('Clean write. Rung 2 is already open.');
  });

  it('does not count a forgiven pointing slip', () => {
    const results = { ...all('correct'), 1: 'nikud-only' as const };
    const outcome = ladderOutcome({}, 'sus', full, results, false);
    expect(outcome).toMatchObject({ clean: false, progress: {} });
    expect(ladderNote(outcome)).toMatch(/pointing included/);
  });

  it('says why a partial table or a peek does not count', () => {
    const partial = ladderOutcome({}, 'sus', cells([true, false, true]), all('correct'), false);
    expect(ladderNote(partial)).toBe('Only a Full table write counts toward the next rung.');
    const peeked = ladderOutcome({}, 'sus', full, all('correct'), true);
    expect(ladderNote(peeked)).toMatch(/You peeked/);
  });

  it('just counts on the top rung', () => {
    const top = ladderOutcome({ pronouns: 2 }, 'pronouns', full, all('correct'), false);
    expect(ladderNote(top)).toBe('Clean write: 3 on the top rung.');
  });
});

describe('ladder progress storage', () => {
  it('lives under this app’s own key', () => {
    localStorage.clear();
    saveLadderProgress({ dabar: 1 });
    expect(localStorage.getItem(LADDER_PROGRESS_KEY)).toBe('{"dabar":1}');
    expect(loadLadderProgress()).toEqual({ dabar: 1 });
  });
});
