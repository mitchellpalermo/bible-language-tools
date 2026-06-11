import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/auth', () => ({
  createAuth: vi.fn(),
}));

import { createAuth } from '../../../lib/auth';
import { GET, POST } from './[...all]';

function makeContext(path = '/api/auth/callback/google?code=test-code&state=test-state') {
  const request = new Request(`http://localhost${path}`, { method: 'GET' });
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

describe('GET /api/auth/[...all]', () => {
  let mockAuth: { handler: Mock };

  beforeEach(() => {
    mockAuth = { handler: vi.fn() };
    (createAuth as Mock).mockReturnValue(mockAuth);
  });

  it('delegates all requests to auth.handler', async () => {
    const expectedResponse = new Response(null, {
      status: 302,
      headers: { Location: '/account/syncing' },
    });
    mockAuth.handler.mockResolvedValue(expectedResponse);

    const ctx = makeContext();
    const response = await GET(ctx as never);

    expect(mockAuth.handler).toHaveBeenCalledWith(ctx.request);
    expect(response).toBe(expectedResponse);
  });

  it('calls createAuth with baseURL derived from the incoming request origin', async () => {
    mockAuth.handler.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext();
    await GET(ctx as never);

    expect(createAuth).toHaveBeenCalledWith(
      ctx.locals.runtime.env.DB,
      'test-secret',
      expect.objectContaining({ baseURL: 'http://localhost' }),
    );
  });

  it('passes Google credentials to createAuth', async () => {
    mockAuth.handler.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext();
    await GET(ctx as never);

    expect(createAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        googleClientId: 'test-client-id',
        googleClientSecret: 'test-client-secret',
      }),
    );
  });

  it('also handles POST requests via the same handler', async () => {
    const expectedResponse = new Response(null, { status: 200 });
    const request = new Request('http://localhost/api/auth/signout', { method: 'POST' });
    const ctx = { ...makeContext(), request };
    mockAuth.handler.mockResolvedValue(expectedResponse);

    const response = await POST(ctx as never);

    expect(mockAuth.handler).toHaveBeenCalledWith(request);
    expect(response).toBe(expectedResponse);
  });
});
