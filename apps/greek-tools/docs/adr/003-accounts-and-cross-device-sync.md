# ADR 003: User Accounts and Cross-Device Study Progress Sync

## Status

Accepted — Auth section amended by [ADR 005](005-oauth-as-sole-auth-provider.md) (2026-06-11)

## Date

2026-06-08

---

## Context

All study progress in greek.tools — SRS card states, study stats, and custom decks — is stored in `localStorage`. This means progress is siloed to a single browser on a single device. A user who switches from desktop to mobile, or clears their browser storage, loses everything.

The motivating requirement is: **a user's study progress should follow them across devices**. This requires persistent server-side storage and a way to identify users across sessions.

The site is Astro 5 + React deployed on Cloudflare Pages. Any solution must be compatible with Cloudflare's edge runtime (Workers) and fit the constraints of a personal project (low operational overhead, low cost).

Three data shapes need to be synced per user:

- `Record<string, SRSCard>` — SM-2 spaced repetition state, keyed by lemma (up to ~1000 entries)
- `StudyStats` — streak, total reviewed, last studied dates
- `CustomDeck[]` — user-created vocabulary lists

---

## Decision

### Auth: Better Auth with Google OAuth

Use **Better Auth** for authentication. It is TypeScript-first, has a native Astro integration, and ships a Cloudflare D1 adapter that manages its own session and user tables.

**Authentication method: Google OAuth only.** Email/password was removed before shipping. The reason: email/password requires a password reset flow, which requires outbound email sending, which requires Cloudflare Email Service, which is only available on the Workers Paid plan ($5/month). There is no capacity pressure justifying that cost. Google OAuth runs entirely on Google's servers and stays on the free plan. See [ADR 005](005-oauth-as-sole-auth-provider.md) for the full rationale.

Clerk was the main alternative. It has excellent DX and a generous free tier (10k MAU), but introduces a hard dependency on a third-party auth vendor — pricing risk for a tool that is intended to remain free and self-sustaining.

### Database: Cloudflare D1

Use **Cloudflare D1** (SQLite at the edge) for persistent storage. The project already uses Cloudflare for hosting and has wrangler in the toolchain; D1 adds no new vendor and no egress cost. The data model is simple and small (SRS data for 1000 words is ~50 KB per user), making SQLite more than sufficient.

Supabase was considered. It would provide a Postgres database plus auth in one package, but it introduces an external vendor and a pricing surface for something that fits naturally in the existing Cloudflare infrastructure.

### ORM: Drizzle

Use **Drizzle** as the ORM. TypeScript-first, zero-runtime overhead, excellent D1 support, and migrations are schema-as-code so they live in version control.

### Sync Strategy: Local-First with Server Sync (Option B)

`localStorage` remains the live source of truth for an active session. Server state is the persistence layer for cross-device continuity.

**On login:** pull server state, merge with local state using per-card merge rules (see below), write merged result back to `localStorage` and to the server.

**During a session:** all reads and writes continue to hit `localStorage` directly. No network round-trips during study.

**On session end:** push the full local state to the server. Triggered on `visibilitychange` (tab hidden/closed) and on an explicit "sync" action.

**On account creation:** detect existing `localStorage` data and offer to import it as the initial server state. This is required — users who have been studying without an account must not lose progress when they sign up.

**Conflict resolution:** when merging two SRS stores (local vs. server), per-card rules are:
- Take the higher `repetition` count (more studied wins)
- If equal, take the later `dueDate`
- For `StudyStats`, take the higher streak and higher totals
- For `CustomDeck[]`, union by deck `id`; last-write-wins on name/wordKeys per deck

The rationale: a merge that favors more progress is always safe. The worst outcome is that a card is slightly further along than it would be if only one device had been used. The alternative — last-write-wins wholesale — risks wiping progress made on a device that was offline.

---

## Cost

All utilities in this stack are either open-source or free within the Cloudflare platform. There is no recurring cost.

| Utility | Role | Free tier | Paid |
|---|---|---|---|
| **Better Auth** | Auth library | Free (open source, self-hosted) | Free |
| **Drizzle** | ORM | Free (open source) | Free |
| **Cloudflare Workers** | Hosts the app | 100k req/day | $5/mo (10M req/mo included) |
| **Cloudflare D1** | Stores user/SRS/sync data | 5M row reads/day, 100k writes/day, 5 GB | Included in Workers Paid — 25B reads + 50M writes/mo |
| **Google OAuth** | Identity provider | Free | Free |

Switching to OAuth-only (ADR 005) eliminated the only line item that required Workers Paid. Email/password auth required Cloudflare Email Service (Workers Paid only) for password reset; Google OAuth has no such dependency. The entire stack runs on the free tier at current and anticipated traffic levels.

## Consequences

**Positive:**
- Study progress survives device switches, browser clears, and new installs
- Offline study continues to work without degradation — `localStorage` is always the hot path
- Stays entirely within the Cloudflare ecosystem; no new vendor dependencies
- Better Auth + D1 is low operational overhead for a personal project
- Conflict resolution is deterministic and safe-by-default

**Negative:**
- Adds meaningful implementation complexity: auth flows, API endpoints, sync logic, merge logic
- Sync on `visibilitychange` is not 100% reliable (mobile browsers may suspend before it fires); a small window of progress loss remains possible if a device dies mid-session
- Users without accounts get no benefit — the existing experience is unchanged until they sign up
- Better Auth is a relatively young library; API surface may shift

---

## Alternatives Considered

### Clerk + Supabase
Fastest path to working auth and a relational database. Rejected because both are paid vendors with pricing surfaces that could conflict with keeping greek.tools free. Also unnecessary complexity when D1 covers the storage requirement.

### Option A (Server as source of truth)
All reads and writes go to the API; `localStorage` is cache only. Simpler consistency model. Rejected because it breaks offline use, which matters for mobile users and anyone in low-connectivity situations (commuting, travel).

### Option C (Full replace on sync)
Wholesale push/pull of the full state on login and logout. Simpler than per-card merging. Rejected because it cannot correctly handle two devices used offline simultaneously — the device that syncs last would overwrite progress from the first. Given that this is a daily habit tool, that scenario is realistic.

### Cloudflare KV for storage
Key-value store instead of D1. Simpler API, no schema needed. Rejected because querying across users (for future admin/analytics needs) is impractical in KV, and the schema for SRS data maps naturally to relational rows. D1 is a better long-term foundation.
