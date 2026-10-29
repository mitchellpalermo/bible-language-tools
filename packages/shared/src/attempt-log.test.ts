import { beforeEach, describe, expect, it } from 'vitest';
import { createAttemptLog, MAX_ATTEMPTS } from './attempt-log';

const { loadAttempts, logAttempts } = createAttemptLog('test-attempts');

beforeEach(() => localStorage.clear());

describe('createAttemptLog', () => {
  it('stamps and appends attempts', () => {
    logAttempts([{ concept: 'a', correct: true, ms: 1200 }], 1000);
    logAttempts([{ concept: 'b', correct: false, confidence: 2 }], 2000);
    expect(loadAttempts()).toEqual([
      { concept: 'a', correct: true, ms: 1200, at: 1000 },
      { concept: 'b', correct: false, confidence: 2, at: 2000 },
    ]);
  });

  it('writes nothing for an empty batch', () => {
    logAttempts([]);
    expect(localStorage.getItem('test-attempts')).toBeNull();
  });

  it('drops the oldest past the cap', () => {
    const many = Array.from({ length: MAX_ATTEMPTS }, (_, i) => ({
      concept: `c${i}`,
      correct: true,
    }));
    logAttempts(many, 1);
    logAttempts([{ concept: 'newest', correct: true }], 2);
    const log = loadAttempts();
    expect(log).toHaveLength(MAX_ATTEMPTS);
    expect(log[0].concept).toBe('c1');
    expect(log.at(-1)?.concept).toBe('newest');
  });

  it('discards malformed entries and bad JSON', () => {
    localStorage.setItem(
      'test-attempts',
      JSON.stringify([{ concept: 'ok', correct: true, at: 1 }, { concept: 'no' }, null, 3]),
    );
    expect(loadAttempts()).toEqual([{ concept: 'ok', correct: true, at: 1 }]);
    localStorage.setItem('test-attempts', 'not json');
    expect(loadAttempts()).toEqual([]);
    localStorage.setItem('test-attempts', '{}');
    expect(loadAttempts()).toEqual([]);
  });

  it('keeps apps apart by key', () => {
    logAttempts([{ concept: 'a', correct: true }]);
    expect(createAttemptLog('other').loadAttempts()).toEqual([]);
  });

  it('never throws when storage is full', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('full');
    };
    try {
      expect(() => logAttempts([{ concept: 'a', correct: true }])).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
