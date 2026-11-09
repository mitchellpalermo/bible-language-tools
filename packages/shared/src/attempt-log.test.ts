import { beforeEach, describe, expect, it } from 'vitest';
import {
  type Attempt,
  attemptsMissingFrom,
  compareAttempts,
  createAttemptLog,
  MAX_ATTEMPT_ID_LENGTH,
  MAX_ATTEMPTS,
  MAX_CONCEPT_LENGTH,
  newAttemptId,
  parseAttempt,
  planAttemptPush,
} from './attempt-log';

const { loadAttempts, logAttempts, saveAttempts } = createAttemptLog('test-attempts');

/** Drop the random ids, for comparing what a drill logged. */
const withoutIds = (log: Attempt[]) => log.map(({ id: _id, ...rest }) => rest);

function attempt(id: string, at: number, overrides: Partial<Attempt> = {}): Attempt {
  return { id, concept: 'c', correct: true, at, ...overrides };
}

beforeEach(() => localStorage.clear());

describe('createAttemptLog', () => {
  it('stamps and appends attempts', () => {
    logAttempts([{ concept: 'a', correct: true, ms: 1200 }], 1000);
    logAttempts([{ concept: 'b', correct: false, confidence: 2 }], 2000);
    expect(withoutIds(loadAttempts())).toEqual([
      { concept: 'a', correct: true, ms: 1200, at: 1000 },
      { concept: 'b', correct: false, confidence: 2, at: 2000 },
    ]);
  });

  it('gives every attempt its own id, even two identical answers in one check', () => {
    logAttempts(
      [
        { concept: 'same', correct: true },
        { concept: 'same', correct: true },
      ],
      5,
    );
    const [a, b] = loadAttempts();
    expect(a.id).toMatch(/^[0-9a-f]{24}$/);
    expect(b.id).not.toBe(a.id);
  });

  it('keeps an id from one read to the next', () => {
    logAttempts([{ concept: 'a', correct: true }], 1);
    expect(loadAttempts()[0].id).toBe(loadAttempts()[0].id);
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
      JSON.stringify([
        { id: 'x', concept: 'ok', correct: true, at: 1 },
        { concept: 'no' },
        { id: 'y', concept: 'bad-ms', correct: true, at: 1, ms: 'slow' },
        { id: 'z', concept: 'bad-confidence', correct: true, at: 1, confidence: 4 },
        null,
        3,
      ]),
    );
    expect(loadAttempts()).toEqual([{ id: 'x', concept: 'ok', correct: true, at: 1 }]);
    localStorage.setItem('test-attempts', 'not json');
    expect(loadAttempts()).toEqual([]);
    localStorage.setItem('test-attempts', '{}');
    expect(loadAttempts()).toEqual([]);
  });

  it('gives an entry from before ids a stable one, by its time and place', () => {
    // What a log written before the sync shipped looks like: one check logged
    // two answers to the same concept at the same moment.
    localStorage.setItem(
      'test-attempts',
      JSON.stringify([
        { concept: 'a', correct: true, at: 7 },
        { concept: 'a', correct: false, at: 7 },
        { concept: 'b', correct: true, at: 9, ms: 400 },
      ]),
    );
    const ids = loadAttempts().map((a) => a.id);
    expect(ids).toEqual(['legacy-7-0', 'legacy-7-1', 'legacy-9-0']);
    expect(loadAttempts().map((a) => a.id)).toEqual(ids);

    // The next write stores them, so they no longer depend on position.
    logAttempts([{ concept: 'c', correct: true }], 10);
    const stored = JSON.parse(localStorage.getItem('test-attempts') ?? '[]');
    expect(stored.slice(0, 3).map((a: Attempt) => a.id)).toEqual(ids);
  });

  it('stores only the known fields', () => {
    saveAttempts([{ ...attempt('a', 1), extra: 'no' } as Attempt]);
    expect(JSON.parse(localStorage.getItem('test-attempts') ?? '')).toEqual([attempt('a', 1)]);
  });

  it('saves the newest MAX_ATTEMPTS', () => {
    const many = Array.from({ length: MAX_ATTEMPTS + 2 }, (_, i) => attempt(`a${i}`, i));
    saveAttempts(many);
    const log = loadAttempts();
    expect(log).toHaveLength(MAX_ATTEMPTS);
    expect(log[0].id).toBe('a2');
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
      expect(() => saveAttempts([attempt('a', 1)])).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('newAttemptId', () => {
  it('is 24 hex characters and does not repeat', () => {
    const ids = new Set(Array.from({ length: 500 }, newAttemptId));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{24}$/);
  });
});

describe('parseAttempt', () => {
  it('accepts a full attempt and copies only its known fields', () => {
    expect(
      parseAttempt({ ...attempt('a', 3, { ms: 10, confidence: 3 }), userId: 'someone-else' }),
    ).toEqual(attempt('a', 3, { ms: 10, confidence: 3 }));
  });

  it('requires an id, unlike the stored log', () => {
    expect(parseAttempt({ concept: 'c', correct: true, at: 1 })).toBeNull();
    expect(parseAttempt(attempt('', 1))).toBeNull();
    expect(parseAttempt(attempt('x'.repeat(MAX_ATTEMPT_ID_LENGTH + 1), 1))).toBeNull();
    expect(parseAttempt(attempt('x'.repeat(MAX_ATTEMPT_ID_LENGTH), 1))).not.toBeNull();
  });

  it('rejects every field of the wrong shape', () => {
    const bad: unknown[] = [
      null,
      'attempt',
      { ...attempt('a', 1), id: 5 },
      attempt('a', 1, { concept: '' }),
      attempt('a', 1, { concept: 'c'.repeat(MAX_CONCEPT_LENGTH + 1) }),
      { ...attempt('a', 1), correct: 'yes' },
      attempt('a', 1.5),
      attempt('a', -1),
      attempt('a', Number.NaN),
      attempt('a', 1, { ms: -1 }),
      attempt('a', 1, { ms: Number.POSITIVE_INFINITY }),
      { ...attempt('a', 1), confidence: 0 },
    ];
    for (const v of bad) expect(parseAttempt(v), JSON.stringify(v)).toBeNull();
  });
});

describe('compareAttempts', () => {
  it('orders by time, then by id', () => {
    const sorted = [attempt('b', 2), attempt('a', 2), attempt('z', 1)].sort(compareAttempts);
    expect(sorted.map((a) => a.id)).toEqual(['z', 'a', 'b']);
    expect(compareAttempts(attempt('a', 1), attempt('a', 1))).toBe(0);
  });
});

describe('attemptsMissingFrom', () => {
  it('returns what the other side lacks, oldest first', () => {
    const log = [attempt('c', 3), attempt('a', 1), attempt('b', 2)];
    expect(attemptsMissingFrom(log, [attempt('b', 2)]).map((a) => a.id)).toEqual(['a', 'c']);
    expect(attemptsMissingFrom(log, log)).toEqual([]);
  });
});

describe('planAttemptPush', () => {
  const log = [attempt('a', 10), attempt('b', 20), attempt('c', 20), attempt('d', 30)];

  it('sends everything from the cursor on, and moves the cursor to when the push began', () => {
    expect(planAttemptPush(log, 20, 10, 99)).toEqual({
      batch: [attempt('b', 20), attempt('c', 20), attempt('d', 30)],
      nextCursor: 99,
      complete: true,
    });
  });

  it('sends the whole log from a cursor of zero', () => {
    expect(planAttemptPush(log, 0, 10, 99).batch).toHaveLength(4);
  });

  it('sends nothing, and still moves on, when nothing is new', () => {
    expect(planAttemptPush(log, 31, 10, 99)).toEqual({ batch: [], nextCursor: 99, complete: true });
  });

  it('resumes a batch cut short at the first attempt it left out', () => {
    expect(planAttemptPush(log, 0, 2, 99)).toEqual({
      batch: [attempt('a', 10), attempt('b', 20)],
      nextCursor: 20,
      complete: false,
    });
    // The next push resends `b`, which the server ignores, and gets `c` and `d`.
    expect(planAttemptPush(log, 20, 2, 99).batch.map((a) => a.id)).toEqual(['b', 'c']);
  });

  it('never resumes where it began, even when the batch is one moment throughout', () => {
    const burst = [attempt('a', 5), attempt('b', 5), attempt('c', 5)];
    expect(planAttemptPush(burst, 0, 2, 99).nextCursor).toBe(6);
  });
});
