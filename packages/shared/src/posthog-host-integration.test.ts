import { describe, expect, it } from 'vitest';
import { posthogHostGuard } from './posthog-host-integration';

const setup = (env: Parameters<typeof posthogHostGuard>[0], command: string) =>
  posthogHostGuard(env).hooks['astro:config:setup']({ command });

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
});
