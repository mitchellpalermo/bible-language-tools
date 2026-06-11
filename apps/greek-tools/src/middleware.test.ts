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

function makeContext(
  sessionUser?: { id: string; email: string } | null,
  { cookies = '' } = {},
) {
  const mockAuth = {
    api: {
      getSession: vi.fn().mockResolvedValue(sessionUser ? { user: sessionUser } : null),
    },
  };
  (createAuth as Mock).mockReturnValue(mockAuth);

  const locals: Record<string, unknown> = {
    runtime: {
      env: {
        DB: {} as D1Database,
        BETTER_AUTH_SECRET: 'test-secret',
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
      },
    },
    user: undefined,
  };
  const headers = new Headers();
  if (cookies) headers.set('cookie', cookies);
  const request = new Request('http://localhost/some-page', { headers });
  const next = vi.fn().mockResolvedValue(new Response('ok'));

  return { locals, request, next, mockAuth };
}

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches user to locals when session is active', async () => {
    const { locals, request, next } = makeContext({ id: 'user-123', email: 'me@example.com' });

    await onRequest({ locals, request } as never, next);

    expect(locals.user).toEqual({ id: 'user-123', email: 'me@example.com' });
  });

  it('sets locals.user to null when there is no session', async () => {
    const { locals, request, next } = makeContext(null);

    await onRequest({ locals, request } as never, next);

    expect(locals.user).toBeNull();
  });

  it('calls next() and returns its response', async () => {
    const { locals, request, next } = makeContext(null);

    const response = await onRequest({ locals, request } as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response).toBeInstanceOf(Response);
  });

  it('calls createAuth with DB, BETTER_AUTH_SECRET, and Google credentials from locals', async () => {
    const { locals, request, next } = makeContext(null);

    await onRequest({ locals, request } as never, next);

    expect(createAuth).toHaveBeenCalledWith(
      (locals.runtime as { env: { DB: D1Database } }).env.DB,
      'test-secret',
      expect.objectContaining({
        googleClientId: 'test-client-id',
        googleClientSecret: 'test-client-secret',
      }),
    );
  });

  it('passes request headers to getSession', async () => {
    const { locals, request, next, mockAuth } = makeContext(null);

    await onRequest({ locals, request } as never, next);

    expect(mockAuth.api.getSession).toHaveBeenCalledWith(
      expect.objectContaining({ headers: request.headers }),
    );
  });

  it('sets the gt-auth hint cookie when a session is active and the cookie is absent', async () => {
    const { locals, request, next } = makeContext({ id: 'user-123', email: 'me@example.com' });

    const response = (await onRequest({ locals, request } as never, next)) as Response;

    expect(response.headers.get('set-cookie')).toContain('gt-auth=1');
  });

  it('does not set the hint cookie when a session is active and the cookie is already present', async () => {
    const { locals, request, next } = makeContext(
      { id: 'user-123', email: 'me@example.com' },
      { cookies: 'gt-auth=1' },
    );

    const response = (await onRequest({ locals, request } as never, next)) as Response;

    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('clears the hint cookie when no session but the cookie is present', async () => {
    const { locals, request, next } = makeContext(null, { cookies: 'gt-auth=1' });

    const response = (await onRequest({ locals, request } as never, next)) as Response;

    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('does nothing to cookies when no session and no hint cookie', async () => {
    const { locals, request, next } = makeContext(null);

    const response = (await onRequest({ locals, request } as never, next)) as Response;

    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
