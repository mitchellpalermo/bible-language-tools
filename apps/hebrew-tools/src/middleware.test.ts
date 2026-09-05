// @vitest-environment node
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/auth', () => ({
  createAuth: vi.fn(),
}));

// Astro virtual modules are not available in Vitest — stub defineMiddleware
vi.mock('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}));

import { createAuth } from './lib/auth';
import { onRequest } from './middleware';

const FULL_ENV = {
  DB: {} as D1Database,
  BETTER_AUTH_SECRET: 'test-secret',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
};

function makeContext(
  sessionUser?: { id: string; email: string } | null,
  { cookies = '', env = FULL_ENV as Partial<typeof FULL_ENV> } = {},
) {
  const mockAuth = {
    api: {
      getSession: vi.fn().mockResolvedValue(sessionUser ? { user: sessionUser } : null),
    },
  };
  (createAuth as Mock).mockReturnValue(mockAuth);

  const locals: Record<string, unknown> = { runtime: { env }, user: undefined };
  const headers = new Headers();
  if (cookies) headers.set('cookie', cookies);
  const request = new Request('http://localhost/some-page', { headers });
  const next = vi.fn().mockResolvedValue(new Response('ok'));

  return { locals, request, next, mockAuth };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('session resolution', () => {
  it('attaches the user to locals when a session is active', async () => {
    const { locals, request, next } = makeContext({ id: 'user-123', email: 'me@example.com' });

    await onRequest({ locals, request } as never, next);

    expect(locals.user).toEqual({ id: 'user-123', email: 'me@example.com' });
  });

  it('sets locals.user to null when there is no session', async () => {
    const { locals, request, next } = makeContext(null);

    await onRequest({ locals, request } as never, next);

    expect(locals.user).toBeNull();
  });

  it('returns next()’s response', async () => {
    const { locals, request, next } = makeContext(null);

    const response = await onRequest({ locals, request } as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response).toBeInstanceOf(Response);
  });

  it('builds auth from the bindings on locals', async () => {
    const { locals, request, next } = makeContext(null);

    await onRequest({ locals, request } as never, next);

    expect(createAuth).toHaveBeenCalledWith(
      FULL_ENV.DB,
      'test-secret',
      expect.objectContaining({
        baseURL: 'http://localhost',
        googleClientId: 'test-client-id',
        googleClientSecret: 'test-client-secret',
      }),
    );
  });

  it('passes the request headers to getSession', async () => {
    const { locals, request, next, mockAuth } = makeContext(null);

    await onRequest({ locals, request } as never, next);

    expect(mockAuth.api.getSession).toHaveBeenCalledWith(
      expect.objectContaining({ headers: request.headers }),
    );
  });
});

describe('missing bindings', () => {
  // `astro dev` without .dev.vars, and preview builds, have no secrets. The
  // site must still render signed-out rather than erroring on every request.
  it.each([
    ['no env at all', {}],
    ['DB only', { DB: FULL_ENV.DB }],
    ['no auth secret', { ...FULL_ENV, BETTER_AUTH_SECRET: undefined }],
    ['no Google client id', { ...FULL_ENV, GOOGLE_CLIENT_ID: undefined }],
    ['no Google client secret', { ...FULL_ENV, GOOGLE_CLIENT_SECRET: undefined }],
  ])('degrades to signed-out with %s', async (_label, env) => {
    const { locals, request, next } = makeContext(null, {
      env: env as Partial<typeof FULL_ENV>,
    });

    const response = await onRequest({ locals, request } as never, next);

    expect(locals.user).toBeNull();
    expect(createAuth).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
  });
});

describe('hint cookie synchronization', () => {
  it('sets the hint cookie when signed in and it is absent', async () => {
    const { locals, request, next } = makeContext({ id: 'user-123', email: 'me@example.com' });

    const response = (await onRequest({ locals, request } as never, next)) as Response;

    expect(response.headers.get('set-cookie')).toContain('ht-auth=1');
  });

  it('leaves it alone when signed in and already present', async () => {
    const { locals, request, next } = makeContext(
      { id: 'user-123', email: 'me@example.com' },
      { cookies: 'ht-auth=1' },
    );

    const response = (await onRequest({ locals, request } as never, next)) as Response;

    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('clears it when signed out but present — a stale session', async () => {
    const { locals, request, next } = makeContext(null, { cookies: 'ht-auth=1' });

    const response = (await onRequest({ locals, request } as never, next)) as Response;

    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('does nothing when signed out and absent', async () => {
    const { locals, request, next } = makeContext(null);

    const response = (await onRequest({ locals, request } as never, next)) as Response;

    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('is not fooled by greek-tools’ cookie on a shared browser', async () => {
    const { locals, request, next } = makeContext(
      { id: 'user-123', email: 'me@example.com' },
      {
        cookies: 'gt-auth=1',
      },
    );

    const response = (await onRequest({ locals, request } as never, next)) as Response;

    expect(response.headers.get('set-cookie')).toContain('ht-auth=1');
  });
});
