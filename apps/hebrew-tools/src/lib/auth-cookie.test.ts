import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTH_HINT_COOKIE,
  authHintClearCookie,
  authHintSetCookie,
  hasAuthHint,
  SESSION_MAX_AGE_SECONDS,
} from './auth-cookie';

function setCookieString(value: string) {
  Object.defineProperty(document, 'cookie', {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  setCookieString('');
});

describe('auth hint cookie', () => {
  it('uses a hebrew-specific name, distinct from greek-tools', () => {
    expect(AUTH_HINT_COOKIE).toBe('ht-auth');
  });

  it('sets a 30-day cookie scoped to the whole site', () => {
    const cookie = authHintSetCookie();
    expect(cookie).toContain(`${AUTH_HINT_COOKIE}=1`);
    expect(cookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('expires the cookie when clearing', () => {
    const cookie = authHintClearCookie();
    expect(cookie).toContain(`${AUTH_HINT_COOKIE}=`);
    expect(cookie).toContain('Max-Age=0');
  });

  it('is not httpOnly — the client has to be able to read it', () => {
    // Deliberate: this cookie exists precisely so prerendered pages can render
    // signed-in nav state. It carries no authority; the session cookie does.
    expect(authHintSetCookie().toLowerCase()).not.toContain('httponly');
  });
});

describe('hasAuthHint', () => {
  it('is true when the cookie is present', () => {
    setCookieString('ht-auth=1');
    expect(hasAuthHint()).toBe(true);
  });

  it('is true when the cookie sits among others', () => {
    setCookieString('other=x; ht-auth=1; another=y');
    expect(hasAuthHint()).toBe(true);
  });

  it('is false when absent', () => {
    setCookieString('other=x');
    expect(hasAuthHint()).toBe(false);
  });

  it('is false for a cleared cookie', () => {
    setCookieString('ht-auth=');
    expect(hasAuthHint()).toBe(false);
  });

  it('does not match greek-tools’ cookie', () => {
    setCookieString('gt-auth=1');
    expect(hasAuthHint()).toBe(false);
  });
});
