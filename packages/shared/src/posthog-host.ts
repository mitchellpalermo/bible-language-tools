/**
 * Build-time guard for the PostHog ingest host.
 *
 * Both apps call `posthog.init(key, { api_host: PUBLIC_POSTHOG_HOST })`. Pointing
 * `api_host` at PostHog's own domain (`us.posthog.com`, `us.i.posthog.com`) works
 * — events arrive — but those domains sit on every common blocklist, so most
 * visitors with an ad blocker or tracking protection silently vanish. Analytics
 * dropped ~85–90% on Jun 10–11, 2026 when the monorepo cutover replaced the
 * first-party proxy (`https://t.greek.tools`) with `https://us.posthog.com`
 * and nothing failed. This guard turns that mistake into a failed build.
 */

export interface PosthogHostEnv {
  PUBLIC_POSTHOG_KEY?: string;
  PUBLIC_POSTHOG_HOST?: string;
  /** Set to `1` to knowingly ship a build that talks to PostHog directly. */
  POSTHOG_ALLOW_DIRECT_HOST?: string;
}

export type PosthogHostCheck = { ok: true } | { ok: false; reason: string };

const POSTHOG_OWN_DOMAIN = /(^|\.)posthog\.com$/i;

const FIX =
  'Set PUBLIC_POSTHOG_HOST to the first-party reverse proxy (https://t.greek.tools). ' +
  'Set POSTHOG_ALLOW_DIRECT_HOST=1 only if you knowingly want to lose ad-blocked visitors.';

/**
 * Judge whether a production build's PostHog configuration will keep events
 * flowing past ad blockers. A build with no key has analytics off entirely, so
 * there is no host to get wrong.
 */
export function checkPosthogHost(env: PosthogHostEnv): PosthogHostCheck {
  if (!env.PUBLIC_POSTHOG_KEY) return { ok: true };
  if (env.POSTHOG_ALLOW_DIRECT_HOST === '1') return { ok: true };

  const raw = env.PUBLIC_POSTHOG_HOST?.trim();
  if (!raw) {
    return {
      ok: false,
      reason: `PUBLIC_POSTHOG_KEY is set but PUBLIC_POSTHOG_HOST is empty, so posthog-js falls back to PostHog's own domain, which ad blockers drop. ${FIX}`,
    };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `PUBLIC_POSTHOG_HOST is not a valid URL: "${raw}". ${FIX}` };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: `PUBLIC_POSTHOG_HOST must be https, got "${raw}". ${FIX}` };
  }

  if (POSTHOG_OWN_DOMAIN.test(url.hostname)) {
    return {
      ok: false,
      reason: `PUBLIC_POSTHOG_HOST is "${raw}", a PostHog-owned domain that ad blockers drop. ${FIX}`,
    };
  }

  return { ok: true };
}
