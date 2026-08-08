import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/auth', () => ({
  createAuth: vi.fn(),
}));

import { createAuth } from '../../../lib/auth';
import { GET, POST } from './[...all]';

function makeContext(path = '/api/auth/callback/google?code=test-code&state=test-state') {
  return {
    request: new Request(`http://localhost${path}`, { method: 'GET' }),
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

describe('/api/auth/[...all]', () => {
  let mockAuth: { handler: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = { handler: vi.fn() };
    (createAuth as Mock).mockReturnValue(mockAuth);
  });

  it('delegates the OAuth callback to auth.handler', async () => {
    const expected = new Response(null, { status: 302, headers: { Location: '/account' } });
    mockAuth.handler.mockResolvedValue(expected);

    const ctx = makeContext();
    const response = await GET(ctx as never);

    expect(mockAuth.handler).toHaveBeenCalledWith(ctx.request);
    expect(response).toBe(expected);
  });

  it('derives baseURL from the request origin', async () => {
    mockAuth.handler.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext();
    await GET(ctx as never);

    expect(createAuth).toHaveBeenCalledWith(
      ctx.locals.runtime.env.DB,
      'test-secret',
      expect.objectContaining({ baseURL: 'http://localhost' }),
    );
  });

  it('passes the Google credentials through', async () => {
    mockAuth.handler.mockResolvedValue(new Response(null, { status: 200 }));

    await GET(makeContext() as never);

    expect(createAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        googleClientId: 'test-client-id',
        googleClientSecret: 'test-client-secret',
      }),
    );
  });

  it('handles POST through the same handler', async () => {
    const expected = new Response(null, { status: 200 });
    const request = new Request('http://localhost/api/auth/sign-in/social', { method: 'POST' });
    mockAuth.handler.mockResolvedValue(expected);

    const response = await POST({ ...makeContext(), request } as never);

    expect(mockAuth.handler).toHaveBeenCalledWith(request);
    expect(response).toBe(expected);
  });
});
