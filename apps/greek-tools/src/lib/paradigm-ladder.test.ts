import { beforeEach, describe, expect, it } from 'vitest';
import { LADDER_RUNG_IDS } from '../data/paradigm-ladder';
import {
  LADDER_PROGRESS_KEY,
  ladderNote,
  ladderOutcome,
  loadLadderProgress,
  saveLadderProgress,
} from './paradigm-ladder';
import type { QuizCell } from './paradigm-quiz';

function cells(answers: string[], blank = true): QuizCell[] {
  return answers.map((answer, index) => ({
    index,
    rowIndex: 0,
    colIndex: index,
    answer,
    isBlank: blank,
  }));
}

const ANSWERS = ['λόγος', 'λόγου', 'λόγῳ'];
const exact = Object.fromEntries(ANSWERS.map((a, i) => [i, a]));

beforeEach(() => localStorage.clear());

describe('storage', () => {
  it('is keyed apart from hebrew.tools', () => {
    expect(LADDER_PROGRESS_KEY).toBe('greek-tools-paradigm-ladder-v1');
  });

  it('round-trips, and reads a corrupt value as a fresh ladder', () => {
    saveLadderProgress({ article: 2 });
    expect(loadLadderProgress()).toEqual({ article: 2 });
    localStorage.setItem(LADDER_PROGRESS_KEY, '{"article":-1}');
    expect(loadLadderProgress()).toEqual({});
    localStorage.setItem(LADDER_PROGRESS_KEY, 'not json');
    expect(loadLadderProgress()).toEqual({});
  });
});

describe('ladderOutcome', () => {
  const run = (
    inputs: Record<number, string>,
    options: { peeked?: boolean; strict?: boolean; progress?: Record<string, number> } = {},
    blank = true,
  ) =>
    ladderOutcome(
      options.progress ?? {},
      'article',
      cells(ANSWERS, blank),
      inputs,
      options.peeked ?? false,
      options.strict ?? false,
    );

  it('counts a Full table with every form exact', () => {
    const outcome = run(exact);
    expect(outcome).toMatchObject({ clean: true, fullTable: true, progress: { article: 1 } });
    expect(outcome.unlocked).toBeUndefined();
  });

  it('opens the next rung on the second clean write', () => {
    expect(run(exact, { progress: { article: 1 } })).toMatchObject({
      clean: true,
      progress: { article: 2 },
      unlocked: 2,
    });
  });

  it('forgives an accent slip with Accents off, never with it on', () => {
    const slip = { ...exact, 1: 'λογου' };
    expect(run(slip).clean).toBe(true);
    expect(run(slip, { strict: true }).clean).toBe(false);
  });

  it('never forgives a missing iota subscript', () => {
    expect(run({ ...exact, 2: 'λόγω' }).clean).toBe(false);
  });

  it('never counts a peeked write, or one with a blank left', () => {
    expect(run(exact, { peeked: true })).toMatchObject({ clean: false, peeked: true });
    expect(run({ 0: 'λόγος', 1: 'λόγου' }).clean).toBe(false);
  });

  it('does not count a partial table, and says it was not one', () => {
    const partial = ladderOutcome(
      {},
      'article',
      [...cells(['λόγος']), ...cells(['λόγου'], false).map((c) => ({ ...c, index: 1 }))],
      { 0: 'λόγος' },
      false,
      false,
    );
    expect(partial).toMatchObject({ clean: false, fullTable: false, progress: {} });
  });

  it('leaves progress untouched by a write that is not clean', () => {
    const before = { article: 1 };
    expect(run({}, { progress: before }).progress).toBe(before);
  });
});

describe('ladderNote', () => {
  const base = {
    rungId: 'article',
    clean: false,
    fullTable: true,
    peeked: false,
    accentStrict: false,
    progress: {},
  };

  it('says how far a clean write got, and what it opened', () => {
    expect(ladderNote({ ...base, clean: true, progress: { article: 1 } })).toBe(
      'Clean write: 1 of 2 toward rung 2.',
    );
    expect(ladderNote({ ...base, clean: true, progress: { article: 2 }, unlocked: 2 })).toBe(
      'Clean write. Rung 2 is open.',
    );
    expect(ladderNote({ ...base, clean: true, progress: { article: 3 } })).toBe(
      'Clean write. Rung 2 is already open.',
    );
  });

  it('counts the top rung on its own terms', () => {
    const top = LADDER_RUNG_IDS[LADDER_RUNG_IDS.length - 1];
    expect(ladderNote({ ...base, rungId: top, clean: true, progress: { [top]: 4 } })).toBe(
      'Clean write: 4 on the top rung.',
    );
  });

  it('gives the reason a write did not count, most basic first', () => {
    expect(ladderNote({ ...base, fullTable: false })).toMatch(/Only a Full Recall write counts/);
    expect(ladderNote({ ...base, peeked: true })).toMatch(/You peeked/);
    expect(ladderNote(base)).toMatch(/breathings and iota subscripts included/);
    expect(ladderNote({ ...base, accentStrict: true })).toMatch(/accents included/);
  });
});
