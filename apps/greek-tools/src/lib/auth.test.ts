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

describe('Sign in with Apple', () => {
  const APPLE = { clientId: 'tools.bible.signin', clientSecret: 'signed-client-secret' };
  const BASE = 'https://greek.tools';

  // Apple answers with a cross-site form POST (response_mode=form_post). A
  // browser that holds any cookie for the site sends it, which makes Better
  // Auth check the Origin header, and Apple's origin is appleid.apple.com.
  function applePost() {
    return new Request(`${BASE}/api/auth/callback/apple`, {
      method: 'POST',
      headers: {
        origin: 'https://appleid.apple.com',
        cookie: 'ph_session=1',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'state=test-state&code=test-code',
    });
  }

  it('is not offered when Apple is not configured', async () => {
    const auth = createAuthForDb(createTestDb() as never, SECRET, {
      ...GOOGLE_OPTS,
      baseURL: BASE,
    });
    const response = await auth.api.signInSocial({
      body: { provider: 'apple', callbackURL: '/account/syncing' },
      asResponse: true,
    });
    expect(response.ok).toBe(false);
  });

  it('sends the student to Apple with a form_post return to this site', async () => {
    const auth = createAuthForDb(createTestDb() as never, SECRET, {
      ...GOOGLE_OPTS,
      baseURL: BASE,
      apple: APPLE,
    });
    const response = await auth.api.signInSocial({
      body: { provider: 'apple', callbackURL: '/account/syncing' },
      asResponse: true,
    });
    const { url } = (await response.json()) as { url: string };
    const authorize = new URL(url);

    expect(authorize.origin + authorize.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(authorize.searchParams.get('client_id')).toBe('tools.bible.signin');
    expect(authorize.searchParams.get('response_mode')).toBe('form_post');
    expect(authorize.searchParams.get('scope')).toContain('email');
    expect(authorize.searchParams.get('scope')).toContain('name');
    // This exact return URL has to be listed on the Services ID in Apple's portal.
    expect(authorize.searchParams.get('redirect_uri')).toBe(`${BASE}/api/auth/callback/apple`);
  });

  it("accepts Apple's form POST and turns it into a same-site GET", async () => {
    const auth = createAuthForDb(createTestDb() as never, SECRET, {
      ...GOOGLE_OPTS,
      baseURL: BASE,
      apple: APPLE,
    });
    const response = await auth.handler(applePost());
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location') ?? '', BASE);
    expect(location.pathname).toBe('/api/auth/callback/apple');
    expect(location.searchParams.get('code')).toBe('test-code');
  });

  // Under Vitest Better Auth skips its origin check, so the POST above passes
  // either way. What makes it pass in production is this list.
  it("trusts Apple's origin only when Apple is configured", async () => {
    const withApple = createAuthForDb(createTestDb() as never, SECRET, {
      ...GOOGLE_OPTS,
      baseURL: BASE,
      apple: APPLE,
    });
    const without = createAuthForDb(createTestDb() as never, SECRET, {
      ...GOOGLE_OPTS,
      baseURL: BASE,
    });

    expect((await withApple.$context).trustedOrigins).toContain('https://appleid.apple.com');
    expect((await without.$context).trustedOrigins).not.toContain('https://appleid.apple.com');
  });
});
