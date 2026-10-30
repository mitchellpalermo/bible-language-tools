import { beforeEach, describe, expect, it } from 'vitest';
import {
  canSkipScaffold,
  createStepDrillHistory,
  DEFAULT_SKIP_POLICY,
  initialStepDrill,
  isCleanPass,
  pushHistory,
  stepDrillReducer,
} from './step-drill';

const right = { type: 'answer', correct: true } as const;
const wrong = (rules: string[] = []) => ({ type: 'answer', correct: false, rules }) as const;

describe('stepDrillReducer', () => {
  it('opens the next step on a right answer, scored right first time', () => {
    const s = stepDrillReducer(initialStepDrill(), right);
    expect(s).toEqual({ step: 1, firstTry: [true], missedOpenStep: false, feedback: [] });
  });

  it('keeps a missed step open, with the rules it broke', () => {
    const s = stepDrillReducer(initialStepDrill(), wrong(['a', 'b']));
    expect(s.step).toBe(0);
    expect(s.missedOpenStep).toBe(true);
    expect(s.feedback).toEqual(['a', 'b']);
  });

  it('scores a step by its first try, however the second goes', () => {
    let s = stepDrillReducer(initialStepDrill(), wrong());
    s = stepDrillReducer(s, right);
    expect(s.step).toBe(1);
    expect(s.firstTry).toEqual([false]);
    expect(s.feedback).toEqual([]);
  });

  it('defaults a miss with no rules to empty feedback', () => {
    const s = stepDrillReducer(initialStepDrill(), { type: 'answer', correct: false });
    expect(s.feedback).toEqual([]);
  });

  it('moves on after a reveal, scored as a miss', () => {
    const s = stepDrillReducer(initialStepDrill(), { type: 'reveal' });
    expect(s.step).toBe(1);
    expect(s.firstTry).toEqual([false]);
  });

  it('resets to a given step', () => {
    const s = stepDrillReducer(stepDrillReducer(initialStepDrill(), right), {
      type: 'reset',
      startAt: 3,
    });
    expect(s).toEqual(initialStepDrill(3));
  });
});

describe('isCleanPass', () => {
  it('is true only when every step is done and right first time', () => {
    let s = initialStepDrill();
    s = stepDrillReducer(s, right);
    expect(isCleanPass(s, 2)).toBe(false);
    s = stepDrillReducer(s, right);
    expect(isCleanPass(s, 2)).toBe(true);
  });

  it('is false after any miss', () => {
    let s = stepDrillReducer(initialStepDrill(), wrong());
    s = stepDrillReducer(s, right);
    expect(isCleanPass(s, 1)).toBe(false);
  });

  it('judges only the steps answered when starting past the scaffold', () => {
    const s = stepDrillReducer(initialStepDrill(3), right);
    expect(isCleanPass(s, 4)).toBe(true);
  });
});

describe('canSkipScaffold', () => {
  const { window } = DEFAULT_SKIP_POLICY;

  it('needs a full window of evidence', () => {
    expect(canSkipScaffold(Array(window - 1).fill(true))).toBe(false);
    expect(canSkipScaffold(Array(window).fill(true))).toBe(true);
  });

  it('needs the threshold over the most recent window', () => {
    const twoMisses = [...Array(window - 2).fill(true), false, false];
    expect(canSkipScaffold(twoMisses)).toBe(true); // 18/20 = 90%
    const threeMisses = [...Array(window - 3).fill(true), false, false, false];
    expect(canSkipScaffold(threeMisses)).toBe(false);
  });

  it('ignores answers older than the window', () => {
    const old = [...Array(10).fill(false), ...Array(window).fill(true)];
    expect(canSkipScaffold(old)).toBe(true);
  });

  it('takes a custom policy', () => {
    expect(canSkipScaffold([true, false], { window: 2, threshold: 0.5 })).toBe(true);
  });
});

describe('pushHistory', () => {
  it('appends and keeps only the window', () => {
    const h = pushHistory(Array(DEFAULT_SKIP_POLICY.window).fill(false), [true, true]);
    expect(h).toHaveLength(DEFAULT_SKIP_POLICY.window);
    expect(h.slice(-2)).toEqual([true, true]);
  });
});

describe('createStepDrillHistory', () => {
  const { loadHistory, saveHistory } = createStepDrillHistory('test-history');
  beforeEach(() => localStorage.clear());

  it('round-trips', () => {
    saveHistory([true, false]);
    expect(loadHistory()).toEqual([true, false]);
  });

  it('is empty when nothing is stored', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('drops anything that is not a boolean', () => {
    localStorage.setItem('test-history', JSON.stringify([true, 'x', 1, false]));
    expect(loadHistory()).toEqual([true, false]);
  });

  it('falls back to empty on bad JSON or a non-array', () => {
    localStorage.setItem('test-history', '{');
    expect(loadHistory()).toEqual([]);
    localStorage.setItem('test-history', '{"a":1}');
    expect(loadHistory()).toEqual([]);
  });

  it('keeps apps apart by key', () => {
    saveHistory([true]);
    expect(createStepDrillHistory('other').loadHistory()).toEqual([]);
  });

  it('swallows a storage failure on save', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('full');
    };
    try {
      expect(() => saveHistory([true])).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
