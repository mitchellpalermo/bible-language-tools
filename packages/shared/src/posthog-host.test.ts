import { describe, expect, it } from 'vitest';
import { checkCspAllowsHost, checkPosthogHost } from './posthog-host';

const KEY = 'phc_test';

describe('checkPosthogHost', () => {
  it('passes a build with no key, since analytics is off', () => {
    expect(checkPosthogHost({})).toEqual({ ok: true });
    expect(checkPosthogHost({ PUBLIC_POSTHOG_HOST: 'https://us.posthog.com' })).toEqual({
      ok: true,
    });
  });

  it('passes the first-party reverse proxy', () => {
    expect(
      checkPosthogHost({ PUBLIC_POSTHOG_KEY: KEY, PUBLIC_POSTHOG_HOST: 'https://t.greek.tools' }),
    ).toEqual({ ok: true });
  });

  it('fails the value that caused the Jun 2026 traffic cliff', () => {
    const result = checkPosthogHost({
      PUBLIC_POSTHOG_KEY: KEY,
      PUBLIC_POSTHOG_HOST: 'https://us.posthog.com',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('us.posthog.com');
  });

  it.each([
    'https://us.i.posthog.com',
    'https://eu.posthog.com',
    'https://app.posthog.com',
    'https://POSTHOG.COM',
  ])('fails PostHog-owned domain %s', (host) => {
    expect(checkPosthogHost({ PUBLIC_POSTHOG_KEY: KEY, PUBLIC_POSTHOG_HOST: host }).ok).toBe(false);
  });

  it('does not mistake a lookalike domain for a PostHog one', () => {
    expect(
      checkPosthogHost({
        PUBLIC_POSTHOG_KEY: KEY,
        PUBLIC_POSTHOG_HOST: 'https://t.notposthog.com',
      }),
    ).toEqual({ ok: true });
  });

  it.each([undefined, '', '   '])('fails a missing host (%j) when a key is set', (host) => {
    const result = checkPosthogHost({ PUBLIC_POSTHOG_KEY: KEY, PUBLIC_POSTHOG_HOST: host });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('empty');
  });

  it('fails a host that is not a URL', () => {
    const result = checkPosthogHost({
      PUBLIC_POSTHOG_KEY: KEY,
      PUBLIC_POSTHOG_HOST: 't.greek.tools',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('not a valid URL');
  });

  it('fails a non-https host', () => {
    const result = checkPosthogHost({
      PUBLIC_POSTHOG_KEY: KEY,
      PUBLIC_POSTHOG_HOST: 'http://t.greek.tools',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('https');
  });

  it('lets POSTHOG_ALLOW_DIRECT_HOST=1 override a failing host', () => {
    expect(
      checkPosthogHost({
        PUBLIC_POSTHOG_KEY: KEY,
        PUBLIC_POSTHOG_HOST: 'https://us.posthog.com',
        POSTHOG_ALLOW_DIRECT_HOST: '1',
      }),
    ).toEqual({ ok: true });
  });

  it('ignores any POSTHOG_ALLOW_DIRECT_HOST value other than 1', () => {
    expect(
      checkPosthogHost({
        PUBLIC_POSTHOG_KEY: KEY,
        PUBLIC_POSTHOG_HOST: 'https://us.posthog.com',
        POSTHOG_ALLOW_DIRECT_HOST: 'true',
      }).ok,
    ).toBe(false);
  });
});

// The hebrew.tools policy as it shipped from May 8 until the fix: the only
// PostHog-capable origin it allowed was a proxy that was never created.
const BROKEN_HEBREW_HEADERS = `/*
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://t.hebrew.tools https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://t.hebrew.tools https://beacon.cloudflareinsights.com; object-src 'none';
`;

const PROXY = 'https://t.greek.tools';

describe('checkCspAllowsHost', () => {
  it('fails the policy that blocked every hebrew.tools flashcard session', () => {
    const result = checkCspAllowsHost(BROKEN_HEBREW_HEADERS, PROXY);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('script-src');
  });

  it('passes once the proxy is in script-src and connect-src', () => {
    const fixed = BROKEN_HEBREW_HEADERS.replaceAll(
      'https://t.hebrew.tools',
      `${PROXY} https://t.hebrew.tools`,
    );
    expect(checkCspAllowsHost(fixed, PROXY)).toEqual({ ok: true });
  });

  it('names connect-src when only script-src allows the host', () => {
    const csp = `  Content-Security-Policy: default-src 'self'; script-src ${PROXY}; connect-src 'self'`;
    const result = checkCspAllowsHost(csp, PROXY);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('connect-src');
  });

  it('falls back to default-src when a directive is absent', () => {
    expect(checkCspAllowsHost(`  Content-Security-Policy: default-src ${PROXY}`, PROXY)).toEqual({
      ok: true,
    });
    expect(checkCspAllowsHost("  Content-Security-Policy: default-src 'self'", PROXY).ok).toBe(
      false,
    );
  });

  it('passes a file with no CSP, since nothing blocks the host', () => {
    expect(checkCspAllowsHost('/*\n  X-Frame-Options: DENY\n', PROXY)).toEqual({ ok: true });
  });

  it('accepts wildcard and scheme sources', () => {
    expect(
      checkCspAllowsHost('  Content-Security-Policy: script-src *; connect-src *', PROXY).ok,
    ).toBe(true);
    expect(
      checkCspAllowsHost('  Content-Security-Policy: script-src https:; connect-src https:', PROXY)
        .ok,
    ).toBe(true);
  });

  it('requires every CSP rule in the file to allow the host', () => {
    const headers = `/*\n  Content-Security-Policy: default-src ${PROXY}\n/other/*\n  Content-Security-Policy: default-src 'self'\n`;
    expect(checkCspAllowsHost(headers, PROXY).ok).toBe(false);
  });

  it('does not treat a lookalike origin as the proxy', () => {
    const csp = `  Content-Security-Policy: default-src https://t.greek.tools.evil.example`;
    expect(checkCspAllowsHost(csp, PROXY).ok).toBe(false);
  });

  it('fails when the host itself is not a URL', () => {
    expect(checkCspAllowsHost(BROKEN_HEBREW_HEADERS, 'nope').ok).toBe(false);
  });
});
