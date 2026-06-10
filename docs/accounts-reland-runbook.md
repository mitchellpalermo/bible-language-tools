# Accounts Re-land — Steps for Mitch

**Date:** 2026-06-10
**PR:** [#57](https://github.com/mitchellpalermo/bible-language-tools/pull/57) — re-lands Phases 1–2 (issues #52, #53) and implements Phases 3–4 (issues #54, #55). Phase 5 (#56) is documented below but intentionally not implemented.

Everything code-side is done: 887 tests pass, typecheck is clean, and `pnpm build` succeeds with no secrets in the environment (the failure mode that forced the original revert). The steps below are the things only you can do.

---

## 1. Before merging PR #57

### 1a. Add the `BETTER_AUTH_SECRET` GitHub secret (required)

CI now runs `wrangler secret put BETTER_AUTH_SECRET` on every deploy, and this repo secret does not exist yet (`gh secret list` shows only the Cloudflare and PostHog secrets). Without it the deploy sets an empty secret.

```bash
openssl rand -base64 33 | gh secret set BETTER_AUTH_SECRET --repo mitchellpalermo/bible-language-tools
```

### 1b. Verify the remote D1 migration journal (required)

CI now applies D1 migrations via `wrangler d1 migrations apply bible-language-tools --remote`. The monorepo migration doc says migrations were applied 2026-06-09, but if they were applied with `drizzle-kit migrate` rather than wrangler, wrangler's journal table won't know about `0000` and CI will try to re-apply it (and fail on `CREATE TABLE users`).

Check from `apps/greek-tools/`:

```bash
pnpm wrangler d1 migrations list bible-language-tools --remote
```

- If `0000_broken_rocket_raccoon.sql` is listed as **applied** and only `0001_futuristic_iron_patriot.sql` is pending: you're done; merge away.
- If `0000` shows as **unapplied** (but the tables exist), mark it applied without running it:

```bash
pnpm wrangler d1 execute bible-language-tools --remote \
  --command "CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP); INSERT INTO d1_migrations (name) VALUES ('0000_broken_rocket_raccoon.sql');"
```

### 1c. Review two decisions I made beyond the issue specs

1. **"Start fresh" in the import flow also clears local progress** (`localStorage`), not just server progress. The issue only specified the server delete, but leaving local data means the next automatic push re-uploads exactly what the user declined to import. If you'd rather preserve local data, say so on the PR and I'll change it.
2. **`syncedAt` lives in a new `sync_state` table** (one row per user+language). Its absence is the "never synced" signal for `GET /api/progress → { data: null }`.

## 2. Merge PR #57

Merging to main triggers the greek-tools workflow: tests → build → set secret → apply migration `0001` → deploy. Watch the run:

```bash
gh run watch --repo mitchellpalermo/bible-language-tools
```

## 3. Verify in production (~5 minutes)

1. Go to https://greek.tools, study a few flashcards (so there's local progress), then **Sign up** from the nav.
2. The import modal should appear — choose **Import**, land on `/account`, and confirm "Last synced just now".
3. Open the site in a private window, sign in with the same account — after the brief "Syncing…" page your cards should be present (check `/flashcards` due counts or `/account`).
4. Sign out; nav should flip back to "Sign in" everywhere, including static pages.
5. Confirm rows landed in D1 (Cloudflare dashboard → D1 → bible-language-tools): `users`, `sessions`, `srs_cards`, `sync_state`.

If anything misbehaves, Workers logs are live: Cloudflare dashboard → Workers → greek-tools → Logs (observability is enabled with full sampling).

## 4. Local development (when you next work on this)

```bash
# apps/greek-tools/.dev.vars already has BETTER_AUTH_SECRET (untracked, kept)
cd apps/greek-tools
pnpm wrangler d1 migrations apply bible-language-tools --local   # local SQLite gets 0001
pnpm dev
```

To preview the production build with real bindings (also what the e2e full-flow
tests need — they're `test.skip` by default):

```bash
pnpm build && pnpm wrangler dev --local-protocol https
# browse https://localhost:8787 and accept the self-signed cert warning
```

The `--local-protocol https` flag matters: Better Auth's session cookie is
`__Secure-` prefixed, and browsers silently drop it on a plain-HTTP origin —
sign-in appears to succeed but the session never persists. (Plain `pnpm dev`
on :4321 is fine; Better Auth uses non-secure cookies in dev mode.)

## 5. Phase 5 — OAuth (#56), when you decide to do it

Not implemented, per the issue's own guidance ("implement only when there is evidence that email/password friction is reducing sign-ups"). When that day comes:

1. Create a Google OAuth app at https://console.cloud.google.com/apis/credentials — authorized redirect URI: `https://greek.tools/api/auth/callback/google`.
2. `pnpm wrangler secret put GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (plus GitHub secrets + workflow steps, same pattern as `BETTER_AUTH_SECRET`).
3. Add `socialProviders: { google: { clientId, clientSecret } }` to `createAuthForDb` in `src/lib/auth.ts` — the schema is already OAuth-ready (`accounts` has `provider_id`, `access_token`, `id_token`, etc.).
4. The account-linking flow (same email, password confirmation) is Better Auth's `account.accountLinking` config — check their docs for the current API before building custom UI.

## 6. Loose ends I noticed (not blockers)

- **Coverage thresholds fail on `main` already** (62.8% statements vs the 90% threshold; this branch improves it slightly to ~65%). CI doesn't run coverage so nothing breaks, but `pnpm test:coverage` is red. The gap is mostly the Focus Passage components. Worth a tracking issue.
- **Root `CLAUDE.md` is stale**: it still says "Cloudflare Pages" and `wrangler pages deploy`; both apps deploy as Workers now (the migration doc has it right). Same for `apps/greek-tools/CLAUDE.md`.
- **The home-directory git repo** (`/Users/mitch` is a git repo pointing at `hebrew-tools.git`, currently on branch `feat/accounts-phase-2-auth`) looks accidental and confused me at the start of this session. Worth cleaning up before it eats a `git clean` someday.
