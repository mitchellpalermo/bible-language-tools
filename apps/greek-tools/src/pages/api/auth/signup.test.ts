import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../../../lib/auth', () => ({
  createAuth: vi.fn(),
}));

import { createAuth } from '../../../lib/auth';
import { POST } from './signup';

function makeContext(fields: Record<string, string>) {
  const body = new URLSearchParams(fields).toString();
  const request = new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return {
    request,
    locals: {
      runtime: { env: { DB: {} as D1Database, BETTER_AUTH_SECRET: 'test-secret' } },
      user: null,
    },
    redirect: (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  };
}

describe('POST /api/auth/signup', () => {
  let mockAuth: { api: { signUpEmail: Mock } };

  beforeEach(() => {
    mockAuth = {
      api: { signUpEmail: vi.fn() },
    };
    (createAuth as Mock).mockReturnValue(mockAuth);
  });

  it('redirects to /account on successful signup', async () => {
    mockAuth.api.signUpEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext({ email: 'test@example.com', password: 'password123' });
    const response = await POST(ctx as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/account');
  });

  it('forwards Set-Cookie headers from Better Auth response on success', async () => {
    const authResponse = new Response(null, { status: 200 });
    authResponse.headers.append('Set-Cookie', 'session=abc; HttpOnly; Path=/');
    authResponse.headers.append('Set-Cookie', 'session.sig=xyz; HttpOnly; Path=/');
    mockAuth.api.signUpEmail.mockResolvedValue(authResponse);

    const ctx = makeContext({ email: 'test@example.com', password: 'password123' });
    const response = await POST(ctx as never);

    const cookies = response.headers.getSetCookie?.() ?? [];
    expect(cookies.some((c: string) => c.startsWith('session=abc'))).toBe(true);
    expect(cookies.some((c: string) => c.startsWith('session.sig=xyz'))).toBe(true);
  });

  it('redirects to signup with error=email_taken when user already exists', async () => {
    mockAuth.api.signUpEmail.mockResolvedValue(
      new Response(JSON.stringify({ code: 'USER_ALREADY_EXISTS' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const ctx = makeContext({ email: 'existing@example.com', password: 'password123' });
    const response = await POST(ctx as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/account/signup?error=email_taken');
  });

  it('redirects to signup with error=error on generic failure', async () => {
    mockAuth.api.signUpEmail.mockResolvedValue(
      new Response(JSON.stringify({ code: 'INTERNAL_ERROR' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const ctx = makeContext({ email: 'test@example.com', password: 'password123' });
    const response = await POST(ctx as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/account/signup?error=error');
  });

  it('calls createAuth with DB and BETTER_AUTH_SECRET from locals', async () => {
    mockAuth.api.signUpEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext({ email: 'test@example.com', password: 'password123' });
    await POST(ctx as never);

    expect(createAuth).toHaveBeenCalledWith(ctx.locals.runtime.env.DB, 'test-secret');
  });

  it('calls signUpEmail with email as name', async () => {
    mockAuth.api.signUpEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext({ email: 'user@example.com', password: 'secret' });
    await POST(ctx as never);

    expect(mockAuth.api.signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: 'user@example.com', password: 'secret', name: 'user@example.com' },
        asResponse: true,
      }),
    );
  });
});
