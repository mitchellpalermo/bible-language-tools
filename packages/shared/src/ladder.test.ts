import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLEAN_WRITES_TO_UNLOCK,
  createLadderProgress,
  isCleanWrite,
  lockText,
  newlyUnlocked,
  recordWrite,
  rungStates,
} from './ladder';
import type { QuizCell } from './paradigm-quiz';

const IDS = ['one', 'two', 'three'];

const cell = (index: number, isBlank = true): QuizCell => ({
  index,
  rowIndex: index,
  colIndex: 0,
  answer: `a${index}`,
  isBlank,
});

describe('rungStates', () => {
  it('opens only the first rung on a fresh ladder', () => {
    const states = rungStates(IDS, {});
    expect(states.map((s) => s.unlocked)).toEqual([true, false, false]);
    expect(states.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(states[1]).toMatchObject({ cleanWrites: 0, belowWrites: 0 });
  });

  it('opens a rung after two clean writes of the one below, and not after one', () => {
    expect(rungStates(IDS, { one: 1 })[1].unlocked).toBe(false);
    const states = rungStates(IDS, { one: CLEAN_WRITES_TO_UNLOCK });
    expect(states[1]).toMatchObject({ unlocked: true, belowWrites: 2 });
    expect(states[2].unlocked).toBe(false);
  });

  it('looks only at the rung directly below, so an opened-anyway rung counts', () => {
    // Rung 2 was opened anyway and written cleanly twice; rung 1 never was.
    const states = rungStates(IDS, { two: 2 });
    expect(states.map((s) => s.unlocked)).toEqual([true, false, true]);
  });
});

describe('isCleanWrite', () => {
  const allExact = () => true;

  it('is every cell blank and exactly right, without a peek', () => {
    expect(isCleanWrite([cell(0), cell(1)], allExact, false)).toBe(true);
  });

  it('is not a partial table, a single miss, a peek, or nothing at all', () => {
    expect(isCleanWrite([cell(0), cell(1, false)], allExact, false)).toBe(false);
    expect(isCleanWrite([cell(0), cell(1)], (c) => c.index === 0, false)).toBe(false);
    expect(isCleanWrite([cell(0)], allExact, true)).toBe(false);
    expect(isCleanWrite([], allExact, false)).toBe(false);
  });
});

describe('recordWrite and newlyUnlocked', () => {
  it('counts clean writes only, without mutating', () => {
    const before = { one: 1 };
    expect(recordWrite(before, 'one', false)).toBe(before);
    expect(recordWrite(before, 'one', true)).toEqual({ one: 2 });
    expect(recordWrite({}, 'two', true)).toEqual({ two: 1 });
    expect(before).toEqual({ one: 1 });
  });

  it('names the rung a write opened, and nothing otherwise', () => {
    expect(newlyUnlocked(IDS, { one: 1 }, { one: 2 })?.id).toBe('two');
    expect(newlyUnlocked(IDS, {}, { one: 1 })).toBeUndefined();
    // A third clean write opens nothing new.
    expect(newlyUnlocked(IDS, { one: 2 }, { one: 3 })).toBeUndefined();
  });
});

describe('lockText', () => {
  it('names the rung below and how far along it is, capped at the target', () => {
    const [, two] = rungStates(IDS, { one: 1 });
    expect(lockText(two)).toBe('Opens after 2 clean writes of rung 1 (1 of 2 so far).');
    expect(lockText({ ...two, belowWrites: 5 })).toContain('(2 of 2 so far)');
  });
});

describe('createLadderProgress', () => {
  const { loadLadderProgress, saveLadderProgress } = createLadderProgress('test-ladder');

  beforeEach(() => localStorage.clear());

  it('round-trips under its own key', () => {
    expect(loadLadderProgress()).toEqual({});
    saveLadderProgress({ one: 2 });
    expect(JSON.parse(localStorage.getItem('test-ladder') ?? '')).toEqual({ one: 2 });
    expect(loadLadderProgress()).toEqual({ one: 2 });
  });

  it('reads anything malformed as a fresh ladder', () => {
    for (const bad of ['not json', '[1,2]', '{"one":-1}', '{"one":1.5}', '{"one":"2"}', 'null']) {
      localStorage.setItem('test-ladder', bad);
      expect(loadLadderProgress(), bad).toEqual({});
    }
  });

  it('swallows a storage failure on save', () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() => saveLadderProgress({ one: 1 })).not.toThrow();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });
});
