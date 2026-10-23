import { describe, expect, it } from 'vitest';
import { checkPosthogHost } from './posthog-host';

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
