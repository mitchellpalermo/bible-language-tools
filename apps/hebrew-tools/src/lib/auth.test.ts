// @vitest-environment node
//
// Integration tests for the Better Auth configuration against the real database
// schema. The route tests mock createAuth, so these are what catch adapter or
// schema mismatches (model mapping, missing columns) — the failure mode that
// would otherwise only show up on a deployed sign-in attempt.
//
// Node environment: happy-dom emulates browser fetch, which strips the
// forbidden Set-Cookie response header these tests rely on.

import { createTestDb } from '@tools/db/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Auth, createAuthForDb } from './auth';

const SECRET = 'integration-test-secret-at-least-32-chars';
const GOOGLE_OPTS = {
  baseURL: 'https://hebrew.tools',
  googleClientId: 'test-client-id',
  googleClientSecret: 'test-client-secret',
};

describe('createAuthForDb (real schema)', () => {
  let auth: Auth;

  beforeEach(() => {
    auth = createAuthForDb(createTestDb() as never, SECRET, GOOGLE_OPTS);
  });

  it('initializes against the shared schema', () => {
    // Throws here if the drizzle adapter can't map its models onto packages/db.
    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe('function');
  });

  it('returns null for an unauthenticated session', async () => {
    const session = await auth.api.getSession({ headers: new Headers() });
    expect(session).toBeNull();
  });

  it('returns a Google authorization URL for social sign-in', async () => {
    const response = await auth.api.signInSocial({
      body: { provider: 'google', callbackURL: '/account' },
      asResponse: true,
    });
    const body = (await response.json()) as { url?: string };

    expect(body.url).toMatch(/accounts\.google\.com/);
    expect(body.url).toContain('test-client-id');
  });

  it('asks Google to return to the hebrew.tools callback', async () => {
    const response = await auth.api.signInSocial({
      body: { provider: 'google', callbackURL: '/account' },
      asResponse: true,
    });
    const { url } = (await response.json()) as { url: string };
    const redirectUri = new URL(url).searchParams.get('redirect_uri');

    // This exact string has to be registered on the Google OAuth client, or
    // sign-in fails with redirect_uri_mismatch before any of our code runs.
    expect(redirectUri).toBe('https://hebrew.tools/api/auth/callback/google');
  });
});
