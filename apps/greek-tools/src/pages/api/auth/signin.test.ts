import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../../../lib/auth', () => ({
  createAuth: vi.fn(),
}));

import { createAuth } from '../../../lib/auth';
import { POST } from './signin';

function makeContext(fields: Record<string, string>) {
  const body = new URLSearchParams(fields).toString();
  const request = new Request('http://localhost/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return {
    request,
    locals: {
      runtime: { env: { DB: {} as D1Database, AUTH_SECRET: 'test-secret' } },
      user: null,
    },
    redirect: (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  };
}

describe('POST /api/auth/signin', () => {
  let mockAuth: { api: { signInEmail: Mock } };

  beforeEach(() => {
    mockAuth = {
      api: { signInEmail: vi.fn() },
    };
    (createAuth as Mock).mockReturnValue(mockAuth);
  });

  it('redirects to /account on successful sign-in', async () => {
    mockAuth.api.signInEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext({ email: 'test@example.com', password: 'password123' });
    const response = await POST(ctx as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/account');
  });

  it('redirects to the `from` param on successful sign-in', async () => {
    mockAuth.api.signInEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext({ email: 'test@example.com', password: 'pw', from: '/study' });
    const response = await POST(ctx as never);

    expect(response.headers.get('Location')).toBe('/study');
  });

  it('forwards Set-Cookie headers from Better Auth response on success', async () => {
    const authResponse = new Response(null, { status: 200 });
    authResponse.headers.append('Set-Cookie', 'session=abc; HttpOnly; Path=/');
    mockAuth.api.signInEmail.mockResolvedValue(authResponse);

    const ctx = makeContext({ email: 'test@example.com', password: 'pw' });
    const response = await POST(ctx as never);

    const cookies = response.headers.getSetCookie?.() ?? [];
    expect(cookies.some((c: string) => c.startsWith('session=abc'))).toBe(true);
  });

  it('redirects to signin with error=invalid on auth failure', async () => {
    mockAuth.api.signInEmail.mockResolvedValue(new Response(null, { status: 401 }));

    const ctx = makeContext({ email: 'test@example.com', password: 'wrong' });
    const response = await POST(ctx as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/account/signin?error=invalid');
  });

  it('preserves the from param in the signin error redirect', async () => {
    mockAuth.api.signInEmail.mockResolvedValue(new Response(null, { status: 401 }));

    const ctx = makeContext({ email: 'test@example.com', password: 'wrong', from: '/study' });
    const response = await POST(ctx as never);

    const location = response.headers.get('Location') ?? '';
    expect(location).toContain('error=invalid');
    expect(location).toContain('from=%2Fstudy');
  });

  it('ignores a non-relative from param to prevent open redirect', async () => {
    mockAuth.api.signInEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext({
      email: 'test@example.com',
      password: 'pw',
      from: 'https://evil.example.com',
    });
    const response = await POST(ctx as never);

    expect(response.headers.get('Location')).toBe('/account');
  });

  it('calls createAuth with DB and AUTH_SECRET from locals', async () => {
    mockAuth.api.signInEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext({ email: 'test@example.com', password: 'pw' });
    await POST(ctx as never);

    expect(createAuth).toHaveBeenCalledWith(ctx.locals.runtime.env.DB, 'test-secret');
  });
});
