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

/**
 * The host passing `checkPosthogHost` is not enough: the page's Content Security
 * Policy must also let the browser reach it. hebrew.tools shipped a CSP that
 * allowed only `https://t.hebrew.tools` (a proxy that was never created), so
 * every static page silently blocked all PostHog traffic and no flashcard
 * session was ever recorded. Only server-rendered pages escape a `_headers` CSP,
 * which is why `/account` was the only path with data.
 */

/** Directives PostHog needs: the SDK script/config load and event uploads. */
const CSP_DIRECTIVES = ['script-src', 'connect-src'] as const;

function sourcesFor(csp: string, directive: string): string[] | null {
  const directives = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name.toLowerCase(), sources);
  }
  return directives.get(directive) ?? directives.get('default-src') ?? null;
}

function allows(sources: string[] | null, origin: string): boolean {
  if (!sources) return true; // no policy for this directive: nothing blocks it
  return sources.some((s) => s === '*' || s === 'https:' || s.replace(/\/$/, '') === origin);
}

/**
 * Check that every `Content-Security-Policy` rule in a Cloudflare `_headers`
 * file allows `host` for scripts and connections. A file with no CSP passes.
 */
export function checkCspAllowsHost(headersText: string, host: string): PosthogHostCheck {
  let origin: string;
  try {
    origin = new URL(host).origin;
  } catch {
    return { ok: false, reason: `Cannot check the CSP: "${host}" is not a valid URL.` };
  }

  const policies = headersText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^content-security-policy\s*:/i.test(line))
    .map((line) => line.replace(/^content-security-policy\s*:/i, '').trim());

  for (const csp of policies) {
    for (const directive of CSP_DIRECTIVES) {
      if (!allows(sourcesFor(csp, directive), origin)) {
        return {
          ok: false,
          reason: `The Content Security Policy in public/_headers does not allow ${origin} in ${directive}, so the browser will block PostHog on every static page. Add ${origin} to ${directive} (and connect-src).`,
        };
      }
    }
  }
  return { ok: true };
}
