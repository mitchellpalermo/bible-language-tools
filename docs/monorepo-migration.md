# Monorepo Migration — greek-tools & hebrew-tools

**Completed:** 2026-06-10

## What Was Done

Both `greek-tools` and `hebrew-tools` were standalone GitHub repos with no automated
deployment pipeline. They were consolidated into the `bible-language-tools` monorepo
and wired up to CI/CD via GitHub Actions.

---

## Deployment Architecture

Both apps deploy as **Cloudflare Workers** using the Workers Assets pattern — not
Cloudflare Pages. This is an important distinction. `wrangler.jsonc` drives the
deployment; `wrangler deploy` (not `wrangler pages deploy`) is the correct command.

Each app has its own workflow:
- `.github/workflows/greek-tools.yml` — triggers on changes to `apps/greek-tools/**` or `packages/shared/**`
- `.github/workflows/hebrew-tools.yml` — triggers on changes to `apps/hebrew-tools/**` or `packages/shared/**`

Deployments are triggered by pushing to `main`. There is no dashboard Git integration —
CI owns the deploy entirely.

---

## GitHub Secrets Required

Set as **repository secrets** (not environment secrets) in `bible-language-tools`:

| Secret | Notes |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Needs: Workers Scripts:Edit, D1:Edit, Workers KV/R2:Edit, Workers Observability:Edit |
| `CLOUDFLARE_ACCOUNT_ID` | `dc08e68f2439ad798cdeeec19463d0ce` |
| `PUBLIC_POSTHOG_KEY` | Astro build-time var — inlined at build, not a runtime secret |
| `PUBLIC_POSTHOG_HOST` | `https://us.posthog.com` |

`PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST` must be passed as `env:` on the
`pnpm build` step (not the deploy step) because Astro inlines them at build time via
`import.meta.env`. They are not Worker runtime environment variables.

---

## Cloudflare API Token Permissions

When creating a token for CI deployment, use these permissions:

- All accounts: Workers Scripts:Edit, Workers KV Storage:Edit, Workers R2 Storage:Edit,
  Workers Observability:Edit, Workers Builds Configuration:Edit, D1:Edit,
  Account Settings:Read, Workers Tail:Read
- All zones: Workers Routes:Edit
- All users: User Details:Read, Memberships:Read

---

## wrangler.jsonc Notes

Both `apps/greek-tools/wrangler.jsonc` and `apps/hebrew-tools/wrangler.jsonc` include:

```json
"workers_dev": false
```

This is required. Without it, Wrangler tries to configure a `workers.dev` subdomain
after every deploy and fails with error code 10001 (auth failure on the subdomain
endpoint). Neither app uses the `workers.dev` subdomain — both are served via custom
domains (`greek.tools`, `hebrew.tools`).

---

## D1 Database

A shared D1 database (`bible-language-tools`, uuid `ab76178b-b59c-4290-b24d-43e1cb09e317`)
was provisioned for future user accounts and cross-device sync. Migrations were applied
on 2026-06-09. Tables: `users`, `sessions`, `accounts`, `verifications`, `srs_cards`,
`study_stats`, `custom_decks`.

The D1 binding is currently only in `apps/greek-tools/wrangler.jsonc`. It was temporarily
removed when auth work was reverted (see below) and will be re-added when accounts are
implemented.

---

## Inflight Work That Was Reverted

During the migration, accounts/auth work (Better Auth, Phase 1 DB schema + Phase 2
implementation) had already been merged to `bible-language-tools` main before the
migration was stable. It was reverted to keep the migration clean:

- `Revert "Merge pull request #2 from mitchellpalermo/feat/accounts-phase-1-db-schema"`
- `Revert "Merge pull request #3 from mitchellpalermo/feat/accounts-phase-2-auth"`

The D1 database and its migrations remain in Cloudflare and are intact. When accounts
work is re-landed, the `packages/db` package and D1 binding in `wrangler.jsonc` need
to be restored. The original PRs (#2 and #3) are in git history and can be referenced.

The env var for Better Auth is `BETTER_AUTH_SECRET` (not `AUTH_SECRET`). It should be
set as a Wrangler secret (`wrangler secret put BETTER_AUTH_SECRET`) and as a GitHub
secret with a corresponding `wrangler secret put` step in the CI workflow.

---

## Analytics

PostHog is configured in `apps/greek-tools/src/layouts/Layout.astro` only. hebrew-tools
has no analytics yet. Both apps would share the same PostHog project if/when hebrew-tools
adds analytics — traffic is distinguishable by the `$host` property (`greek.tools` vs
`hebrew.tools`) in PostHog dashboards.

---

## Isolated Repos

The original standalone repos (`greek-tools`, `hebrew-tools`) were updated with
deprecation notices in their READMEs and pushed. They should be archived on GitHub
(Settings → Danger Zone → Archive repository) when convenient. All feature work was
confirmed present in the monorepo before archiving.

One gap found during the audit: `src/pages/study.astro` was missing from the monorepo
(the nav linked to `/study` but the page didn't exist, causing a live 404). It was
ported from the `feat/study-nav` branch of the isolated repo and deployed on 2026-06-10.
