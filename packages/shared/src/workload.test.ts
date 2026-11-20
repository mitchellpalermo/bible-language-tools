import { afterEach, describe, expect, it } from 'vitest';
import { daysFromNow, newCard } from './srs';
import {
  countDue,
  createWorkloadStore,
  DEFAULT_LIMIT_MINUTES,
  DEFAULT_SECONDS_PER_REVIEW,
  defaultWorkloadState,
  estimateWorkload,
  MAX_ANSWER_SECONDS,
  MIN_PACE_SAMPLES,
  PACE_WINDOW,
  parseWorkloadState,
  recordPace,
  secondsPerReview,
  workloadAdvice,
} from './workload';

describe('the pace', () => {
  it('keeps the recent answers, and drops a walk-away', () => {
    expect(recordPace([5], 8)).toEqual([5, 8]);
    expect(recordPace([5], MAX_ANSWER_SECONDS + 1)).toEqual([5]);
    expect(recordPace([5], 0)).toEqual([5]);
    expect(recordPace([5], Number.NaN)).toEqual([5]);
    const full = Array.from({ length: PACE_WINDOW }, (_, i) => i + 1);
    const next = recordPace(full, 99);
    expect(next).toHaveLength(PACE_WINDOW);
    expect(next.at(-1)).toBe(99);
    expect(next[0]).toBe(2);
  });

  it('is the default until there are enough answers, then their median', () => {
    expect(secondsPerReview([])).toBe(DEFAULT_SECONDS_PER_REVIEW);
    expect(secondsPerReview(Array(MIN_PACE_SAMPLES - 1).fill(3))).toBe(DEFAULT_SECONDS_PER_REVIEW);
    expect(secondsPerReview([], 12)).toBe(12);
    // One slow card does not move a median.
    expect(secondsPerReview([...Array(10).fill(4), 100])).toBe(4);
    expect(secondsPerReview([...Array(5).fill(4), ...Array(5).fill(6)])).toBe(5);
  });
});

describe('the estimate', () => {
  it('counts every due card in the store, and nothing scheduled later', () => {
    expect(
      countDue({
        a: newCard('a'),
        b: { ...newCard('b'), dueDate: daysFromNow(-3) },
        c: { ...newCard('c'), dueDate: daysFromNow(1) },
      }),
    ).toBe(2);
  });

  it('counts only the keys an app says are flashcards', () => {
    const store = { a: newCard('a'), 'paradigm:x': newCard('paradigm:x') };
    expect(countDue(store, (k) => !k.startsWith('paradigm:'))).toBe(1);
  });

  it('is due cards times the pace, against the limit', () => {
    expect(estimateWorkload(120, 10, 20)).toEqual({
      due: 120,
      seconds: 1200,
      minutes: 20,
      limitMinutes: 20,
      overLimit: false,
    });
    const over = estimateWorkload(121, 10, 20);
    expect(over.overLimit).toBe(true);
    expect(over.minutes).toBe(21);
  });

  it('suggests a pause past the limit, and a resume once back under', () => {
    const over = estimateWorkload(200, 10, 20);
    const under = estimateWorkload(10, 10, 20);
    expect(workloadAdvice(over, false)).toBe('pause');
    expect(workloadAdvice(over, true)).toBeNull();
    expect(workloadAdvice(under, true)).toBe('resume');
    expect(workloadAdvice(under, false)).toBeNull();
  });
});

describe('the stored state', () => {
  const KEY = 'test-workload-v1';
  afterEach(() => localStorage.clear());

  it('starts unpaused at 20 minutes with no pace', () => {
    expect(createWorkloadStore(KEY).load()).toEqual({
      pauseNew: false,
      limitMinutes: DEFAULT_LIMIT_MINUTES,
      paceSeconds: [],
    });
  });

  it('round-trips, under its own key only', () => {
    const store = createWorkloadStore(KEY);
    const state = { pauseNew: true, limitMinutes: 30, paceSeconds: [4, 6] };
    store.save(state);
    expect(store.load()).toEqual(state);
    expect(createWorkloadStore('other-key').load()).toEqual(defaultWorkloadState());
  });

  it('reads damaged storage field by field', () => {
    localStorage.setItem(KEY, '{not json');
    expect(createWorkloadStore(KEY).load()).toEqual(defaultWorkloadState());
    expect(parseWorkloadState(null)).toEqual(defaultWorkloadState());
    expect(
      parseWorkloadState({ pauseNew: 'yes', limitMinutes: -5, paceSeconds: [3, 'x', 0, 500, 7] }),
    ).toEqual({ pauseNew: false, limitMinutes: DEFAULT_LIMIT_MINUTES, paceSeconds: [3, 7] });
    expect(parseWorkloadState({ pauseNew: true, paceSeconds: 'no' })).toEqual({
      pauseNew: true,
      limitMinutes: DEFAULT_LIMIT_MINUTES,
      paceSeconds: [],
    });
  });

  it('survives storage that refuses a write', () => {
    const store = createWorkloadStore(KEY);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() => store.save(defaultWorkloadState())).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
