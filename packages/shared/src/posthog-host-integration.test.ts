import { describe, expect, it } from 'vitest';
import { posthogHostGuard } from './posthog-host-integration';

const setup = (
  env: Parameters<typeof posthogHostGuard>[0],
  command: string,
  options?: Parameters<typeof posthogHostGuard>[1],
) => posthogHostGuard(env, options).hooks['astro:config:setup']({ command });

const BAD = { PUBLIC_POSTHOG_KEY: 'phc_test', PUBLIC_POSTHOG_HOST: 'https://us.posthog.com' };

describe('posthogHostGuard', () => {
  it('throws on a build with a blocked host', () => {
    expect(() => setup(BAD, 'build')).toThrow(/posthog-host-guard.*us\.posthog\.com/);
  });

  it('passes a build with the first-party proxy', () => {
    expect(() =>
      setup({ ...BAD, PUBLIC_POSTHOG_HOST: 'https://t.greek.tools' }, 'build'),
    ).not.toThrow();
  });

  it.each(['dev', 'preview', 'sync'])('does not check on `astro %s`', (command) => {
    expect(() => setup(BAD, command)).not.toThrow();
  });

  describe('with a _headers file', () => {
    const GOOD = { PUBLIC_POSTHOG_KEY: 'phc_test', PUBLIC_POSTHOG_HOST: 'https://t.greek.tools' };
    const BLOCKING = { headers: "  Content-Security-Policy: default-src 'self'" };
    const ALLOWING = { headers: '  Content-Security-Policy: default-src https://t.greek.tools' };

    it('throws when the CSP would block the proxy', () => {
      expect(() => setup(GOOD, 'build', BLOCKING)).toThrow(/Content Security Policy/);
    });

    it('passes when the CSP allows the proxy', () => {
      expect(() => setup(GOOD, 'build', ALLOWING)).not.toThrow();
    });

    it('skips the CSP check when analytics is off', () => {
      expect(() => setup({}, 'build', BLOCKING)).not.toThrow();
    });

    it('skips the CSP check under POSTHOG_ALLOW_DIRECT_HOST=1', () => {
      expect(() =>
        setup({ ...GOOD, POSTHOG_ALLOW_DIRECT_HOST: '1' }, 'build', BLOCKING),
      ).not.toThrow();
    });

    it('does not check on dev', () => {
      expect(() => setup(GOOD, 'dev', BLOCKING)).not.toThrow();
    });
  });
});
