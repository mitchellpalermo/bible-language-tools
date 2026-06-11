// @vitest-environment node
//
// Integration tests for the Better Auth configuration against the real
// database schema. The route tests mock createAuth, so these are what catch
// adapter/schema mismatches (model mapping, missing columns).
//
// Node environment: happy-dom emulates browser fetch, which strips the
// forbidden Set-Cookie response header that these tests assert on.

import { createTestDb } from '@tools/db/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Auth, createAuthForDb } from './auth';

const SECRET = 'integration-test-secret-at-least-32-chars';
const BASE_URL = 'https://greek.tools';
const GOOGLE_OPTS = {
  baseURL: BASE_URL,
  googleClientId: 'test-client-id',
  googleClientSecret: 'test-client-secret',
};

describe('createAuthForDb (real schema)', () => {
  let auth: Auth;

  beforeEach(() => {
    auth = createAuthForDb(createTestDb() as never, SECRET, GOOGLE_OPTS);
  });

  it('returns null for an unauthenticated session', async () => {
    const session = await auth.api.getSession({ headers: new Headers() });
    expect(session).toBeNull();
  });

  it('returns an OAuth authorization URL for the Google provider', async () => {
    const response = await auth.api.signInSocial({
      body: { provider: 'google', callbackURL: '/account/syncing' },
      asResponse: true,
    });
    const body = (await response.json()) as { url?: string; redirect?: boolean };
    expect(body.url).toMatch(/accounts\.google\.com/);
    expect(body.url).toContain('test-client-id');
  });

  it('initializes with the correct handler interface', () => {
    // Catches misconfigured adapter or schema mismatches that throw on init
    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe('function');
  });
});
