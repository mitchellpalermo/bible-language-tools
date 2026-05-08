# ADR 001: Use PostHog for Analytics

## Status

Accepted

## Date

2026-04-02

---

## Context

greek.tools has no visibility into how users interact with the site. The primary question motivating analytics is: **are users returning for the daily verse?** Secondary questions include which tools get the most use and where users drop off in interactive flows like Flashcards and the Paradigm Quiz.

The site is built on Astro 5 + React, deployed on Cloudflare Pages. Any analytics solution needs to:

- Work with a static/edge-rendered Astro site
- Support custom event tracking from React components
- Answer retention questions (returning users over time)
- Ideally not require a consent banner or cookie notice for most users

Several options were evaluated.

---

## Decision

Use **PostHog** (cloud-hosted, US region) for analytics.

PostHog is initialized via `posthog-js` in the site layout. A `PostHogProvider` wraps React islands to enable `usePostHog()` in components. Custom events follow the taxonomy defined in the Analytics PRD (`docs/prd/analytics.md`). Session replay is enabled at a 20% sample rate.

---

## Consequences

**Positive:**
- Retention charts directly answer the daily verse return question
- Session replay surfaces qualitative usage patterns without user interviews
- React SDK integrates naturally with the existing component architecture
- Generous free tier (1M events/month) — greek.tools is unlikely to exceed this
- Self-hostable on Cloudflare if data sovereignty becomes a concern later

**Negative:**
- Data is sent to PostHog's servers (US cloud); not zero-party
- Adds `posthog-js` to the client bundle (~35 KB gzipped)
- Anonymous device-based identity means cross-device usage appears as separate users

---

## Alternatives Considered

### Cloudflare Web Analytics
Built into the existing infrastructure. Free, no bundle cost, privacy-first. Rejected because it only provides pageview and referrer data — no custom events, no retention analysis, no session replay. Cannot answer the daily verse return question.

### Umami (self-hosted on Cloudflare Workers + D1)
Open source, free to run, custom events supported, data stays in Cloudflare infrastructure. Rejected because it requires maintaining a separate Workers application and D1 database. No session replay. The operational overhead is not justified for a personal project at this stage — though it remains a viable migration target if PostHog's pricing becomes a concern.

### Mixpanel
Strong funnel and retention analysis, 20M event free tier. Rejected because it has no session replay, no self-host option, and offers no meaningful advantage over PostHog for this use case.

### Google Analytics 4
Free, most powerful traffic analysis. Rejected because it requires a cookie consent banner (GDPR), adds significant bundle weight, and sends data to Google — a poor fit for a tool used in a scholarly/educational context where users may be privacy-conscious.
