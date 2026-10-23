# ADR 007: PostHog events go through a first-party reverse proxy, and the build enforces it

## Status

Accepted

## Date

2026-10-23

---

## Context

[ADR 001](001-analytics-posthog.md) chose PostHog. It did not record *where the browser sends events*, and that turned out to matter more than the choice of vendor.

Until Jun 10, 2026, greek.tools sent every event to `https://t.greek.tools`, a PostHog-managed reverse proxy on the site's own domain (the project's `set_up_reverse_proxy` onboarding task). Ad blockers, Safari and Firefox tracking protection and Brave all block `posthog.com` hosts, but not a first-party subdomain.

The monorepo cutover (commit `251af0c`, Jun 10) moved the build to GitHub Actions and began injecting `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST` from repository secrets. `PUBLIC_POSTHOG_HOST` was set to `https://us.posthog.com`. Events kept arriving, so nothing looked broken, but:

- Every event before Jun 11 carried `$lib_custom_api_host = https://t.greek.tools`; every event from the new build (posthog-js 1.383.2) carries none.
- Daily pageviews fell from about 45-110 to about 1-19, and daily users from about 20-32 to about 1-6, within two days. Direct, Google and internal referrals all fell together.
- The proxy itself was healthy the whole time. The new build simply was not pointed at it.

Retention, daily-verse-return and funnel data from Jun 11 onward undercounts ad-blocked visitors, and cannot be backfilled.

The failure was silent because the SDK treats any reachable host as valid. Nothing in the repo, the CI run or PostHog itself flagged the change.

### hebrew.tools was never tracked on its static pages (found the same day)

A second, older failure sat behind the first. hebrew.tools' `public/_headers` Content Security Policy (CSP), present since the May 8 monorepo import, allowed only `https://t.hebrew.tools` in `script-src` and `connect-src`. That proxy was never created (no DNS record). The browser therefore blocked every PostHog request on every static page, whatever `PUBLIC_POSTHOG_HOST` said: the SDK config fetch and each `/e/` upload were refused in the console, and no `hebrew_flashcard_*`, `hebrew_paradigm_*` or other custom event has ever reached PostHog.

Only `/account/*` produced data. Those routes are server-rendered by the Worker, and a `_headers` file applies only to static assets, so they never received the policy. That is why about 118 of hebrew.tools' roughly 150 pageviews since July were on `/account`, and none were on `/flashcards`.

An earlier version of this ADR (and PR 168's description) said hebrew.tools worked through `t.greek.tools`. That was inferred from `/account` events, which bypass the CSP, and was wrong for every other page.

---

## Decision

1. **`PUBLIC_POSTHOG_HOST` is the first-party proxy (`https://t.greek.tools`)**, never a PostHog-owned domain. `ui_host` stays `https://us.posthog.com`; it only builds links into the PostHog app.
2. **The build enforces it.** `posthogHostGuard(process.env)` (`@tools/shared/posthog-host-integration`) is registered in both apps' `astro.config.mjs`. On `astro build`, if `PUBLIC_POSTHOG_KEY` is set, the build fails when the host is empty, not a valid `https` URL, or on `posthog.com`. Builds with no key (local, forks, test jobs) are unaffected, as are `dev` and `preview`.
3. **There is an explicit escape hatch.** `POSTHOG_ALLOW_DIRECT_HOST=1` lets a build knowingly ship direct-to-PostHog. It must be set deliberately; a typo in the secret cannot trigger it.
4. **The CSP must allow the host, and the build checks that too.** Each app passes its `public/_headers` text to `posthogHostGuard`; when analytics is on, every `Content-Security-Policy` rule in it must allow the host in `script-src` and `connect-src` (falling back to `default-src`). hebrew.tools' CSP now lists `https://t.greek.tools` as well as `https://t.hebrew.tools`, and each app has a test that reads its real `_headers` file. The same `POSTHOG_ALLOW_DIRECT_HOST=1` override skips this check.

---

## Consequences

**Positive**
- The Jun 2026 mistake becomes a red CI run on the deploy job instead of four months of quietly thin data.
- The rule lives in one tested shared module (`posthog-host.ts`), not in two workflow files.

**Negative / limits**
- The guard reads `process.env`, which is what CI provides. A `PUBLIC_POSTHOG_HOST` that exists only in a local `.env` is not checked.
- It checks the *shape* of the host and that the CSP allows it, not that the proxy is reachable or forwards correctly. A dead proxy would still pass.
- hebrew.tools shares the same two secrets and therefore sends to `t.greek.tools`, which is cross-site for it. That works only because its CSP now allows that origin. The sturdier setup is a dedicated `t.hebrew.tools` proxy with per-app secrets (issue #169); the CSP already lists that origin, so no policy change is needed then, and `t.greek.tools` can be dropped from hebrew.tools' CSP once it is in use.
- A CSP in `_headers` covers static pages only. Server-rendered routes (`/account/*`) never receive it, so their analytics can look healthy while every static page is blocked. Check a static path, not just `/account`.

**Detecting it from the data side:** in PostHog, chart `$pageview` by `$lib_custom_api_host`. A drop of the proxy value to `none` is the first regression. A site whose study events (`hebrew_flashcard_reviewed`) never appear while `/account` pageviews do is the second; in the browser it shows as CSP violations in the console.
