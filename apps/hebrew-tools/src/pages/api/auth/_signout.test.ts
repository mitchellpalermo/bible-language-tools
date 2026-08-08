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
      runtime: {
        env: {
          DB: {} as D1Database,
          BETTER_AUTH_SECRET: 'test-secret',
          GOOGLE_CLIENT_ID: 'test-client-id',
          GOOGLE_CLIENT_SECRET: 'test-client-secret',
        },
      },
      user: null,
    },
  };
}

describe('POST /api/auth/signout', () => {
  let mockAuth: { api: { signOut: Mock } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = { api: { signOut: vi.fn() } };
    (createAuth as Mock).mockReturnValue(mockAuth);
  });

  it('redirects home', async () => {
    mockAuth.api.signOut.mockResolvedValue(new Response(null, { status: 200 }));

    const response = await POST(makeContext() as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/');
  });

  it('forwards Better Auth’s session-clearing cookies', async () => {
    const authResponse = new Response(null, { status: 200 });
    authResponse.headers.append('Set-Cookie', 'session=; Max-Age=0; HttpOnly; Path=/');
    mockAuth.api.signOut.mockResolvedValue(authResponse);

    const response = await POST(makeContext() as never);

    const cookies = response.headers.getSetCookie?.() ?? [];
    expect(cookies.some((c) => c.includes('session=') && c.includes('Max-Age=0'))).toBe(true);
  });

  it('clears the ht-auth hint cookie', async () => {
    mockAuth.api.signOut.mockResolvedValue(new Response(null, { status: 200 }));

    const response = await POST(makeContext() as never);

    const cookies = response.headers.getSetCookie?.() ?? [];
    expect(cookies.some((c) => c.startsWith('ht-auth=;') && c.includes('Max-Age=0'))).toBe(true);
  });

  it('passes the incoming headers to signOut', async () => {
    mockAuth.api.signOut.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext();
    await POST(ctx as never);

    expect(mockAuth.api.signOut).toHaveBeenCalledWith(
      expect.objectContaining({ headers: ctx.request.headers, asResponse: true }),
    );
  });

  it('builds auth from the bindings on locals', async () => {
    mockAuth.api.signOut.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext();
    await POST(ctx as never);

    expect(createAuth).toHaveBeenCalledWith(
      ctx.locals.runtime.env.DB,
      'test-secret',
      expect.objectContaining({
        googleClientId: 'test-client-id',
        googleClientSecret: 'test-client-secret',
      }),
    );
  });
});
