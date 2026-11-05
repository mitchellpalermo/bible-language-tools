// @vitest-environment node
import { MAX_ATTEMPTS_PER_REQUEST } from '@tools/shared/attempt-log';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tools/db', () => ({ createDb: vi.fn(() => ({})) }));
vi.mock('../../lib/progress-store', () => ({
  getAttempts: vi.fn(),
  appendAttempts: vi.fn(),
}));

import { appendAttempts, getAttempts } from '../../lib/progress-store';
import { GET, MAX_BODY_BYTES, POST } from './attempts';

const valid = { id: 'a1', concept: 'paradigm/qal-qatal-strong:3ms', correct: true, at: 1 };

function ctx(body?: unknown, { signedIn = true } = {}) {
  return {
    locals: {
      user: signedIn ? { id: 'user-1', email: 'me@example.com' } : null,
      runtime: { env: { DB: {} as D1Database } },
    },
    request: new Request('http://localhost/api/attempts', {
      method: 'POST',
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
    ['POST', () => POST(ctx({ attempts: [valid] }, { signedIn: false }) as never)],
  ])('%s returns 401 when signed out, without touching the database', async (_m, call) => {
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(getAttempts).not.toHaveBeenCalled();
    expect(appendAttempts).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
  it("returns the signed-in user's attempts", async () => {
    vi.mocked(getAttempts).mockResolvedValue([valid]);

    const response = await GET(ctx() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ attempts: [valid] });
    expect(vi.mocked(getAttempts).mock.calls[0][1]).toBe('user-1');
  });
});

describe('POST', () => {
  it('appends a valid batch for the signed-in user, keeping only known fields', async () => {
    const response = await POST(ctx({ attempts: [{ ...valid, userId: 'someone-else' }] }) as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(vi.mocked(appendAttempts).mock.calls[0].slice(1)).toEqual(['user-1', [valid]]);
  });

  it('accepts an empty batch and a full one', async () => {
    expect((await POST(ctx({ attempts: [] }) as never)).status).toBe(200);
    const full = Array.from({ length: MAX_ATTEMPTS_PER_REQUEST }, (_, i) => ({
      ...valid,
      id: `a${i}`,
    }));
    expect((await POST(ctx({ attempts: full }) as never)).status).toBe(200);
  });

  it.each([
    ['a non-object body', '"attempts"'],
    ['a null body', 'null'],
    ['no attempts', JSON.stringify({})],
    ['attempts that are not a list', JSON.stringify({ attempts: { a: valid } })],
    ['an attempt with no id', JSON.stringify({ attempts: [{ ...valid, id: undefined }] })],
    ['an attempt of the wrong shape', JSON.stringify({ attempts: [valid, { ...valid, at: 'x' }] })],
    [
      'more attempts than one request may carry',
      JSON.stringify({
        attempts: Array.from({ length: MAX_ATTEMPTS_PER_REQUEST + 1 }, (_, i) => ({
          ...valid,
          id: `a${i}`,
        })),
      }),
    ],
  ])('rejects %s with 400', async (_label, body) => {
    const response = await POST(ctx(body) as never);
    expect(response.status).toBe(400);
    expect(appendAttempts).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with 400', async () => {
    expect((await POST(ctx('{not json') as never)).status).toBe(400);
  });

  it('rejects a body over the size cap with 413', async () => {
    const response = await POST(
      ctx(JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES + 1) })) as never,
    );
    expect(response.status).toBe(413);
    expect(appendAttempts).not.toHaveBeenCalled();
  });
});
