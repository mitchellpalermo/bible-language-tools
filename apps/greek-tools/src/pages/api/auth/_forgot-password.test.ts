import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/auth', () => ({
  createAuth: vi.fn(),
}));

import { createAuth } from '../../../lib/auth';
import { POST } from './forgot-password';

function makeContext(fields: Record<string, string>) {
  const body = new URLSearchParams(fields).toString();
  const request = new Request('http://localhost/api/auth/forgot-password', {
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

describe('POST /api/auth/forgot-password', () => {
  let mockAuth: { api: { requestPasswordReset: Mock } };

  beforeEach(() => {
    mockAuth = { api: { requestPasswordReset: vi.fn().mockResolvedValue({}) } };
    (createAuth as Mock).mockReturnValue(mockAuth);
  });

  it('requests a reset with the reset-password redirect target', async () => {
    const ctx = makeContext({ email: 'student@example.com' });
    const response = await POST(ctx as never);

    expect(mockAuth.api.requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: 'student@example.com', redirectTo: '/account/reset-password' },
      }),
    );
    expect(response.headers.get('Location')).toBe('/account/forgot-password?sent=1');
  });

  it('returns the same response when the API throws (no enumeration)', async () => {
    mockAuth.api.requestPasswordReset.mockRejectedValue(new Error('user not found'));

    const ctx = makeContext({ email: 'nobody@example.com' });
    const response = await POST(ctx as never);

    expect(response.headers.get('Location')).toBe('/account/forgot-password?sent=1');
  });

  it('redirects with an error when email is missing', async () => {
    const ctx = makeContext({});
    const response = await POST(ctx as never);

    expect(mockAuth.api.requestPasswordReset).not.toHaveBeenCalled();
    expect(response.headers.get('Location')).toBe('/account/forgot-password?error=missing');
  });
});
