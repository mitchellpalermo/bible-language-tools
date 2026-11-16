import { describe, expect, it } from 'vitest';
import {
  fieldFlag,
  isSessionLength,
  percent,
  propertyAccuracy,
  scoreColor,
  toggleValue,
} from './parse-drill';

const PROPERTIES = [
  { key: 'stem', label: 'Stem' },
  { key: 'person', label: 'Person' },
];

describe('propertyAccuracy', () => {
  it('counts each field over the forms that asked it', () => {
    const results = [
      { allCorrect: true, stem: true, person: true },
      { allCorrect: false, stem: false, person: true },
      // An infinitive: no person was asked.
      { allCorrect: true, stem: true },
    ];
    expect(propertyAccuracy(results, PROPERTIES)).toEqual([
      { key: 'stem', label: 'Stem', correct: 2, asked: 3, pct: 67 },
      { key: 'person', label: 'Person', correct: 2, asked: 2, pct: 100 },
    ]);
  });

  it('reads a field nobody was asked as 0 of 0', () => {
    const results = [{ allCorrect: true, stem: true }];
    expect(propertyAccuracy(results, PROPERTIES)[1]).toMatchObject({
      correct: 0,
      asked: 0,
      pct: 0,
    });
  });
});

describe('helpers', () => {
  it('fieldFlag reads a flag, or undefined when absent', () => {
    expect(fieldFlag({ allCorrect: true, stem: false } as never, 'stem')).toBe(false);
    expect(fieldFlag({ allCorrect: true }, 'stem')).toBeUndefined();
  });

  it('percent rounds and never divides by zero', () => {
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
  });

  it('scoreColor is green, amber, red at 80 and 60', () => {
    expect(scoreColor(80)).toBe('#16a34a');
    expect(scoreColor(60)).toBe('#d97706');
    expect(scoreColor(59)).toBe('#dc2626');
  });

  it('isSessionLength accepts 10, 20 and 30 only', () => {
    expect([10, 20, 30].every(isSessionLength)).toBe(true);
    expect(isSessionLength(15)).toBe(false);
    expect(isSessionLength('20')).toBe(false);
  });

  it('toggleValue adds and removes, keeping order', () => {
    expect(toggleValue(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleValue(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});
