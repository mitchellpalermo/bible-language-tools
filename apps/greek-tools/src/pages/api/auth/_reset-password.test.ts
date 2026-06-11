import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/auth', () => ({
  createAuth: vi.fn(),
}));

import { createAuth } from '../../../lib/auth';
import { POST } from './reset-password';

function makeContext(fields: Record<string, string>) {
  const body = new URLSearchParams(fields).toString();
  const request = new Request('http://localhost/api/auth/reset-password', {
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

describe('POST /api/auth/reset-password', () => {
  let mockAuth: { api: { resetPassword: Mock } };

  beforeEach(() => {
    mockAuth = { api: { resetPassword: vi.fn() } };
    (createAuth as Mock).mockReturnValue(mockAuth);
  });

  it('resets the password and redirects to sign-in with confirmation', async () => {
    mockAuth.api.resetPassword.mockResolvedValue(new Response(null, { status: 200 }));

    const ctx = makeContext({ token: 'tok123', password: 'new-password-1' });
    const response = await POST(ctx as never);

    expect(mockAuth.api.resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ body: { newPassword: 'new-password-1', token: 'tok123' } }),
    );
    expect(response.headers.get('Location')).toBe('/account/signin?reset=1');
  });

  it('redirects with invalid error when the token is rejected', async () => {
    mockAuth.api.resetPassword.mockResolvedValue(new Response(null, { status: 400 }));

    const ctx = makeContext({ token: 'expired', password: 'new-password-1' });
    const response = await POST(ctx as never);

    expect(response.headers.get('Location')).toBe('/account/reset-password?error=invalid');
  });

  it('rejects a short password and preserves the token', async () => {
    const ctx = makeContext({ token: 'tok123', password: 'short' });
    const response = await POST(ctx as never);

    expect(mockAuth.api.resetPassword).not.toHaveBeenCalled();
    expect(response.headers.get('Location')).toBe(
      '/account/reset-password?error=short&token=tok123',
    );
  });

  it('rejects a missing token', async () => {
    const ctx = makeContext({ password: 'new-password-1' });
    const response = await POST(ctx as never);

    expect(mockAuth.api.resetPassword).not.toHaveBeenCalled();
    expect(response.headers.get('Location')).toBe('/account/reset-password?error=invalid');
  });
});
