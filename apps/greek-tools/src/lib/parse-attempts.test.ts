import type { Attempt } from '@tools/shared/attempt-log';
import { mergeAttempts } from '@tools/shared/sync-merge';
import { describe, expect, it } from 'vitest';
import { parseConcept, parseHistoryAsAttempts, passageIdOfConcept } from './parse-attempts';

const logged = (passage: string, correct: boolean, at: number, id: string): Attempt => ({
  id,
  concept: parseConcept(passage),
  correct,
  at,
});

describe('parseConcept', () => {
  it('round-trips a passage id', () => {
    expect(passageIdOfConcept(parseConcept('abc123'))).toBe('abc123');
  });

  it('is null for a concept that is not a parse', () => {
    expect(passageIdOfConcept('paradigm/ladder/1')).toBeNull();
  });
});

describe('parseHistoryAsAttempts', () => {
  it('turns an aggregate into exactly that many attempts, with the same correct count', () => {
    const out = parseHistoryAsAttempts({ p1: { correct: 7, total: 10 } }, []);
    expect(out).toHaveLength(10);
    expect(out.filter((a) => a.correct)).toHaveLength(7);
    expect(out.every((a) => a.concept === parseConcept('p1'))).toBe(true);
  });

  it('gives every attempt a stable, unique id and an unknown time', () => {
    const store = { p1: { correct: 2, total: 5 }, p2: { correct: 0, total: 3 } };
    const first = parseHistoryAsAttempts(store, []);
    const second = parseHistoryAsAttempts(store, []);
    expect(second).toEqual(first);
    expect(new Set(first.map((a) => a.id)).size).toBe(8);
    expect(first.every((a) => a.at === 0)).toBe(true);
  });

  it('does not count answers already in the log a second time', () => {
    const log = [logged('p1', true, 10, 'x1'), logged('p1', false, 11, 'x2')];
    const out = parseHistoryAsAttempts({ p1: { correct: 7, total: 10 } }, log);
    expect(out).toHaveLength(10);
    expect(out.filter((a) => a.correct)).toHaveLength(7);
    expect(out.filter((a) => a.at !== 0)).toHaveLength(2);
  });

  it('never goes negative when the log holds more than the totals', () => {
    const log = [
      logged('p1', true, 1, 'a'),
      logged('p1', true, 2, 'b'),
      logged('p1', true, 3, 'c'),
    ];
    const out = parseHistoryAsAttempts({ p1: { correct: 1, total: 1 } }, log);
    expect(out).toHaveLength(3);
  });

  it('keeps the correct remainder within the remainder', () => {
    const log = [logged('p1', false, 1, 'a'), logged('p1', false, 2, 'b')];
    const out = parseHistoryAsAttempts({ p1: { correct: 1, total: 3 } }, log);
    expect(out.filter((a) => a.id.startsWith('legacy-'))).toEqual([
      expect.objectContaining({ correct: true }),
    ]);
  });

  it('leaves other concepts out and keeps logged parses for passages with no totals', () => {
    const other: Attempt = { id: 'o', concept: 'accent/x', correct: true, at: 5 };
    const orphan = logged('gone', true, 6, 'g');
    expect(parseHistoryAsAttempts({}, [other, orphan])).toEqual([orphan]);
  });

  it('survives the shared merge: union by id, no double counting, symmetric', () => {
    const a = parseHistoryAsAttempts({ p1: { correct: 3, total: 4 } }, []);
    expect(mergeAttempts(a, a)).toHaveLength(4);
    expect(mergeAttempts(a, [])).toEqual(mergeAttempts([], a));
  });
});
