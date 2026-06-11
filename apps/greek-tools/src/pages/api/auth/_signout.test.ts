import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/auth', () => ({
  createAuth: vi.fn(),
}));

import { createAuth } from '../../../lib/auth';
import { POST } from './signout';

function makeContext() {
  const request = new Request('http://localhost/api/auth/signout', {
    method: 'POST',
    headers: { Cookie: 'session=abc' },
  });
  return {
    request,
    locals: {
      runtime: { env: { DB: {} as D1Database, BETTER_AUTH_SECRET: 'test-secret' } },
      user: null,
    },
  };
}

describe('POST /api/auth/signout', () => {
  let mockAuth: { api: { signOut: Mock } };

  beforeEach(() => {
    mockAuth = {
      api: { signOut: vi.fn() },
    };
    (createAuth as Mock).mockReturnValue(mockAuth);
  });

  it('redirects to / after sign-out', async () => {
    mockAuth.api.signOut.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext();
    const response = await POST(ctx as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/');
  });

  it('forwards Set-Cookie headers from Better Auth to clear the session cookie', async () => {
    const authResponse = new Response(null, { status: 200 });
    authResponse.headers.append('Set-Cookie', 'session=; Max-Age=0; HttpOnly; Path=/');
    mockAuth.api.signOut.mockResolvedValue(authResponse);

    const ctx = makeContext();
    const response = await POST(ctx as never);

    const cookies = response.headers.getSetCookie?.() ?? [];
    expect(cookies.some((c: string) => c.includes('Max-Age=0'))).toBe(true);
  });

  it('clears the gt-auth hint cookie', async () => {
    mockAuth.api.signOut.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext();
    const response = await POST(ctx as never);

    const cookies = response.headers.getSetCookie?.() ?? [];
    expect(cookies.some((c: string) => c.startsWith('gt-auth=;') && c.includes('Max-Age=0'))).toBe(
      true,
    );
  });

  it('passes the incoming request headers to signOut', async () => {
    mockAuth.api.signOut.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext();
    await POST(ctx as never);

    expect(mockAuth.api.signOut).toHaveBeenCalledWith(
      expect.objectContaining({ headers: ctx.request.headers, asResponse: true }),
    );
  });

  it('calls createAuth with DB and BETTER_AUTH_SECRET from locals', async () => {
    mockAuth.api.signOut.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext();
    await POST(ctx as never);

    expect(createAuth).toHaveBeenCalledWith(ctx.locals.runtime.env.DB, 'test-secret');
  });
});
