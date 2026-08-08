// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tools/db', () => ({ createDb: vi.fn(() => ({})) }));
vi.mock('../../lib/progress-store', () => ({
  getProgress: vi.fn(),
  putProgress: vi.fn(),
  deleteProgress: vi.fn(),
}));

import { deleteProgress, getProgress, putProgress } from '../../lib/progress-store';
import { DELETE, GET, MAX_BODY_BYTES, PUT } from './progress';

const validStats = {
  streak: 3,
  lastStreakDate: '2026-08-08',
  cardsStudiedToday: 7,
  lastStudyDate: '2026-08-08',
  totalReviewed: 42,
  totalCorrect: 35,
};

const validCard = {
  interval: 6,
  repetition: 2,
  easeFactor: 2.5,
  dueDate: '2026-08-14',
  lastReviewed: '2026-08-08',
};

function ctx(body?: unknown, { signedIn = true } = {}) {
  return {
    locals: {
      user: signedIn ? { id: 'user-1', email: 'me@example.com' } : null,
      runtime: { env: { DB: {} as D1Database } },
    },
    request: new Request('http://localhost/api/progress', {
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth', () => {
  it.each([
    ['GET', () => GET(ctx(undefined, { signedIn: false }) as never)],
    ['PUT', () => PUT(ctx({ srsStore: {}, studyStats: validStats }, { signedIn: false }) as never)],
    ['DELETE', () => DELETE(ctx(undefined, { signedIn: false }) as never)],
  ])('%s returns 401 when signed out', async (_method, call) => {
    const response = await call();
    expect(response.status).toBe(401);
    // Identical message for missing and expired sessions — do not leak which.
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('does not touch the database when signed out', async () => {
    await GET(ctx(undefined, { signedIn: false }) as never);
    expect(getProgress).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
  it('returns the stored payload', async () => {
    const payload = { srsStore: {}, studyStats: validStats, syncedAt: '2026-08-08T12:00:00.000Z' };
    vi.mocked(getProgress).mockResolvedValue(payload);

    const response = await GET(ctx() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: payload });
  });

  it('returns data: null for an account that has never synced', async () => {
    vi.mocked(getProgress).mockResolvedValue(null);

    expect(await (await GET(ctx() as never)).json()).toEqual({ data: null });
  });
});

describe('PUT validation', () => {
  it('accepts a well-formed payload and returns the server syncedAt', async () => {
    vi.mocked(putProgress).mockResolvedValue('2026-08-08T12:00:00.000Z');

    const response = await PUT(ctx({ srsStore: { מֶלֶךְ: validCard }, studyStats: validStats }) as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ syncedAt: '2026-08-08T12:00:00.000Z' });
  });

  it('ignores a client-supplied syncedAt', async () => {
    vi.mocked(putProgress).mockResolvedValue('server-time');

    await PUT(ctx({ srsStore: {}, studyStats: validStats, syncedAt: 'client-lies' }) as never);

    expect(vi.mocked(putProgress).mock.calls[0][2]).not.toHaveProperty('syncedAt');
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await PUT(ctx('{not json') as never);
    expect(response.status).toBe(400);
  });

  it('rejects a body over the size cap with 413', async () => {
    const huge = 'x'.repeat(MAX_BODY_BYTES + 1);
    const response = await PUT(ctx(JSON.stringify({ pad: huge })) as never);

    expect(response.status).toBe(413);
    expect(putProgress).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-object body', '"just a string"'],
    ['a missing srsStore', JSON.stringify({ studyStats: validStats })],
    ['an array srsStore', JSON.stringify({ srsStore: [], studyStats: validStats })],
    ['missing studyStats', JSON.stringify({ srsStore: {} })],
    [
      'a non-numeric stats counter',
      JSON.stringify({ srsStore: {}, studyStats: { ...validStats, streak: 'three' } }),
    ],
    [
      'a non-string stats date',
      JSON.stringify({ srsStore: {}, studyStats: { ...validStats, lastStudyDate: 20260808 } }),
    ],
    [
      'a card with a non-numeric interval',
      JSON.stringify({
        srsStore: { מֶלֶךְ: { ...validCard, interval: 'six' } },
        studyStats: validStats,
      }),
    ],
    [
      'a card missing dueDate',
      JSON.stringify({
        srsStore: { מֶלֶךְ: { interval: 1, repetition: 1, easeFactor: 2.5, lastReviewed: '' } },
        studyStats: validStats,
      }),
    ],
    [
      'a null card',
      JSON.stringify({ srsStore: { מֶלֶךְ: null }, studyStats: validStats }),
    ],
  ])('rejects %s with 400', async (_label, body) => {
    const response = await PUT(ctx(body) as never);

    expect(response.status).toBe(400);
    expect(putProgress).not.toHaveBeenCalled();
  });
});

describe('DELETE', () => {
  it('clears progress for the signed-in user', async () => {
    vi.mocked(deleteProgress).mockResolvedValue(undefined);

    const response = await DELETE(ctx() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(vi.mocked(deleteProgress).mock.calls[0][1]).toBe('user-1');
  });
});
