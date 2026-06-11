# ADR 005: Google OAuth as Sole Authentication Provider

## Status

Accepted

## Date

2026-06-11

---

## Context

PR #57 implements Phases 1–4 of the accounts feature using Better Auth with email/password authentication. A cost analysis performed before merging that PR revealed two blockers that make email/password auth unviable on Cloudflare's free plan:

**1. CPU time limit.** Cloudflare Workers free plan caps CPU time at 10ms per invocation. Password hashing (bcrypt/argon2, used by Better Auth for email/password auth) is intentionally CPU-intensive and reliably exceeds this limit, causing sign-up and sign-in requests to fail. The paid plan raises this ceiling substantially, but the only reason to pay for it is to unblock password hashing.

**2. Email sending requires Workers Paid.** Password reset — the only transactional email needed in the email/password flow — requires Cloudflare Email Service, which is only available on the Workers Paid plan ($5/month). There is no free tier for outbound email.

Current request volume is ~560 requests/day across both workers, well under the free plan's 100,000/day ceiling. D1 usage is similarly negligible. The Workers Paid plan would be paid exclusively to unlock email/password auth — not for any capacity reason.

A newsletter or other bulk email use case may arise later, but that warrants a dedicated tool (Resend, Postmark, etc.) with list management and deliverability dashboards, not the Cloudflare Email Service binding. It can be added independently when there are users worth emailing.

The existing schema is already OAuth-ready: the `accounts` table carries `provider_id`, `access_token`, `id_token`, `refresh_token`, etc., and was designed from the start to support multiple providers (see ADR 003).

---

## Decision

Replace email/password with **Google OAuth** as the sole authentication method. Remove the `emailAndPassword` plugin from Better Auth, all password reset infrastructure, and the Cloudflare Email Service binding. Email/password is not deferred — it is removed.

GitHub OAuth (Issue #56, feature 5.3) is explicitly out of scope until there is evidence of user demand.

---

## Consequences

**Positive:**
- Stays on the Workers free plan — no recurring cost
- Eliminates the CPU time concern entirely; the CPU-intensive OAuth token validation happens on Google's servers, not ours
- Removes Cloudflare Email Service as a dependency; no domain onboarding, SPF/DKIM setup, or email deliverability surface
- Simpler auth surface: no passwords to store, hash, or reset; the `password` column in `accounts` is left nullable and unused
- Google accounts are near-universal for the likely user base (biblical language students)

**Negative:**
- Users without a Google account cannot sign in; no fallback auth method
- GitHub OAuth and Apple Sign-In are not available at launch
- The `email` field on `users` is populated by Google and cannot be changed by the user

---

## Cost

| Utility | Role | Free tier | Paid |
|---|---|---|---|
| **Better Auth** | Auth library | Free (open source, self-hosted) | Free |
| **Drizzle** | ORM | Free (open source) | Free |
| **Cloudflare Workers** | Hosts the app | 100k req/day | $5/mo (10M req/mo included) |
| **Cloudflare D1** | Stores user/SRS/sync data | 5M row reads/day, 100k writes/day, 5 GB | Included in Workers Paid — 25B reads + 50M writes/mo |
| **Google OAuth** | Identity provider | Free | Free |

Removing email/password auth eliminates the only line item that required Workers Paid. The remaining stack runs entirely on the free tier at current and anticipated traffic levels.

---

## Alternatives Considered

### Email/password only (original PR #57 approach)
Rejected. Requires Workers Paid for both email sending (password reset) and to clear the 10ms CPU limit for bcrypt. No capacity pressure justifies the cost.

### Email/password + Google OAuth (feature spec Phase 5 original framing)
Rejected for the same reason. Keeping email/password alongside OAuth preserves all the same cost triggers — bcrypt still runs, password reset email still needs to send.

### Defer OAuth; upgrade to Workers Paid
Rejected. The $5/month paid plan would be paid solely to support email/password auth. Switching to OAuth removes the need entirely and costs nothing.
