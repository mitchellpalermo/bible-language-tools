import { readFileSync } from 'node:fs';
import { checkCspAllowsHost } from '@tools/shared/posthog-host';
import { describe, expect, it } from 'vitest';

// PUBLIC_POSTHOG_HOST is a CI secret, so the build guard cannot run in the test
// suite. This pins the other half: the shipped CSP must let the browser reach
// the first-party proxy the secret is meant to hold. Vitest runs from the app
// directory, so the path is relative to it.
describe('public/_headers Content Security Policy', () => {
  it('allows the PostHog reverse proxy for scripts and connections', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    expect(checkCspAllowsHost(headers, 'https://t.greek.tools')).toEqual({ ok: true });
  });
});
