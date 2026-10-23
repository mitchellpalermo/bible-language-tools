import { checkCspAllowsHost, checkPosthogHost, type PosthogHostEnv } from './posthog-host';

export interface PosthogHostGuardOptions {
  /** Contents of the app's `public/_headers`; when given, its CSP is checked too. */
  headers?: string;
}

/**
 * Astro integration that fails `astro build` when PostHog would lose visitors:
 * either the ingest host is a blocklisted PostHog domain, or the app's Content
 * Security Policy would stop the browser reaching it (see `posthog-host.ts`).
 * Dev and preview servers are untouched. Pass `process.env`, which is what CI
 * supplies; values that exist only in a local `.env` file are not seen.
 */
export function posthogHostGuard(env: PosthogHostEnv, options: PosthogHostGuardOptions = {}) {
  return {
    name: 'posthog-host-guard',
    hooks: {
      'astro:config:setup': ({ command }: { command: string }) => {
        if (command !== 'build') return;
        const result = checkPosthogHost(env);
        if (!result.ok) throw new Error(`[posthog-host-guard] ${result.reason}`);

        // Same escape hatch as the host check, and only when analytics is on.
        if (options.headers === undefined) return;
        if (!env.PUBLIC_POSTHOG_KEY || env.POSTHOG_ALLOW_DIRECT_HOST === '1') return;
        const csp = checkCspAllowsHost(options.headers, env.PUBLIC_POSTHOG_HOST ?? '');
        if (!csp.ok) throw new Error(`[posthog-host-guard] ${csp.reason}`);
      },
    },
  };
}
