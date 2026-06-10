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
const email = 'student@example.com';
const password = 'password123';

describe('createAuthForDb (real schema)', () => {
  let auth: Auth;

  beforeEach(() => {
    auth = createAuthForDb(createTestDb() as never, SECRET);
  });

  async function signUp() {
    return auth.api.signUpEmail({
      body: { email, password, name: email },
      asResponse: true,
    });
  }

  it('signs up a new user', async () => {
    const response = await signUp();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { email: string } };
    expect(body.user.email).toBe(email);
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
  });

  it('rejects a duplicate email with USER_ALREADY_EXISTS', async () => {
    await signUp();
    const response = await signUp();
    expect(response.ok).toBe(false);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toMatch(/^USER_ALREADY_EXISTS/);
  });

  it('signs in with correct credentials and creates a session', async () => {
    await signUp();

    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    expect(response.status).toBe(200);

    const cookies = response.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThan(0);

    // The session cookie round-trips through getSession
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
    const session = await auth.api.getSession({
      headers: new Headers({ Cookie: cookieHeader }),
    });
    expect(session?.user.email).toBe(email);
  });

  it('rejects sign-in with a wrong password', async () => {
    await signUp();
    const response = await auth.api.signInEmail({
      body: { email, password: 'wrong-password' },
      asResponse: true,
    });
    expect(response.ok).toBe(false);
  });
});
