import { checkPosthogHost, type PosthogHostEnv } from './posthog-host';

/**
 * Astro integration that fails `astro build` when the PostHog ingest host would
 * lose ad-blocked visitors (see `posthog-host.ts`). Dev and preview servers are
 * untouched. Pass `process.env`, which is what CI supplies; values that exist only in
 * a local `.env` file are not seen.
 */
export function posthogHostGuard(env: PosthogHostEnv) {
  return {
    name: 'posthog-host-guard',
    hooks: {
      'astro:config:setup': ({ command }: { command: string }) => {
        if (command !== 'build') return;
        const result = checkPosthogHost(env);
        if (!result.ok) throw new Error(`[posthog-host-guard] ${result.reason}`);
      },
    },
  };
}
