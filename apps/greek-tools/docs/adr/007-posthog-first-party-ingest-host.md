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

---

## Decision

1. **`PUBLIC_POSTHOG_HOST` is the first-party proxy (`https://t.greek.tools`)**, never a PostHog-owned domain. `ui_host` stays `https://us.posthog.com`; it only builds links into the PostHog app.
2. **The build enforces it.** `posthogHostGuard(process.env)` (`@tools/shared/posthog-host-integration`) is registered in both apps' `astro.config.mjs`. On `astro build`, if `PUBLIC_POSTHOG_KEY` is set, the build fails when the host is empty, not a valid `https` URL, or on `posthog.com`. Builds with no key (local, forks, test jobs) are unaffected, as are `dev` and `preview`.
3. **There is an explicit escape hatch.** `POSTHOG_ALLOW_DIRECT_HOST=1` lets a build knowingly ship direct-to-PostHog. It must be set deliberately; a typo in the secret cannot trigger it.

---

## Consequences

**Positive**
- The Jun 2026 mistake becomes a red CI run on the deploy job instead of four months of quietly thin data.
- The rule lives in one tested shared module (`posthog-host.ts`), not in two workflow files.

**Negative / limits**
- The guard reads `process.env`, which is what CI provides. A `PUBLIC_POSTHOG_HOST` that exists only in a local `.env` is not checked.
- It checks the *shape* of the host, not that the proxy is reachable or forwards correctly. A dead proxy would still pass.
- hebrew.tools shares the same two secrets today and therefore sends to `t.greek.tools`. The managed proxy has not been verified to accept events from the hebrew.tools origin; a separate proxy (for example `t.hebrew.tools`) needs per-app secrets, which is a follow-up.

**Detecting it from the data side:** in PostHog, chart `$pageview` by `$lib_custom_api_host`. A drop of the proxy value to `none` is this regression.
