# Accounts Re-land — Steps for Mitch

**Date:** 2026-06-11 (revised from 2026-06-10)
**PR:** [#57](https://github.com/mitchellpalermo/bible-language-tools/pull/57) — re-lands Phases 1–2 (issues #52, #53), implements Phases 3–4 (issues #54, #55). Email/password auth and password reset (#58) have been **replaced with Google OAuth** before merging. See ADR 005 (`apps/greek-tools/docs/adr/005-oauth-as-sole-auth-provider.md`) for the rationale.

**Current state as of 2026-06-11:**
- `BETTER_AUTH_SECRET` has been added as a GitHub Actions secret. ✅
- D1 migration journal verified: `0000` is applied, only `0001_futuristic_iron_patriot.sql` is pending. ✅
- PR #57 is **not yet merged**. The code changes in section 2 must be applied to the branch before merging.

---

## 1. Before merging: infrastructure setup

### 1a. Create a Google OAuth application (required)

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) and create a project (or use an existing one).
2. Enable the **Google Identity / OAuth 2.0** API.
3. Create an **OAuth 2.0 Client ID** — application type: **Web application**.
4. Add these authorized redirect URIs:
   - `https://greek.tools/api/auth/callback/google`
   - `http://localhost:4321/api/auth/callback/google`
5. Note the **Client ID** and **Client Secret**.

### 1b. Add Google secrets to the Cloudflare Worker (required)

From `apps/greek-tools/`:

```bash
echo "YOUR_CLIENT_ID" | pnpm wrangler secret put GOOGLE_CLIENT_ID
echo "YOUR_CLIENT_SECRET" | pnpm wrangler secret put GOOGLE_CLIENT_SECRET
```

### 1c. Add Google secrets to GitHub Actions (required)

CI sets Cloudflare Worker secrets on every deploy. Add both so they survive re-deploys:

```bash
gh secret set GOOGLE_CLIENT_ID --repo mitchellpalermo/bible-language-tools
gh secret set GOOGLE_CLIENT_SECRET --repo mitchellpalermo/bible-language-tools
```

### 1d. Add Google secrets to `.dev.vars` for local dev

`apps/greek-tools/.dev.vars` (untracked) already has `BETTER_AUTH_SECRET`. Add:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 2. Before merging: code changes to PR #57

All changes are within `apps/greek-tools/`. The goal is to replace email/password auth with Google OAuth while leaving Phases 1–4 (D1 schema, sync API, client sync wiring) intact. No D1 migration is needed — the `accounts` table already carries `provider_id`, `access_token`, `id_token`, etc.

### 2a. Update `src/env.d.ts`

Remove the `EMAIL` binding and add the Google OAuth env vars:

```typescript
interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}
```

### 2b. Rewrite `src/lib/auth.ts`

Remove `emailAndPassword`, `SendEmailFn`, and `resetPasswordEmail`. Add `socialProviders` with Google. `baseURL` is now required at every call site so Better Auth constructs the correct OAuth redirect URI.

```typescript
import { createDb } from '@tools/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { SESSION_MAX_AGE_SECONDS } from './auth-cookie';

type AuthDb = Parameters<typeof drizzleAdapter>[0];

export interface CreateAuthOptions {
  baseURL: string;
  googleClientId: string;
  googleClientSecret: string;
}

export function createAuthForDb(db: AuthDb, secret: string, options: CreateAuthOptions) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', usePlural: true }),
    secret,
    baseURL: options.baseURL,
    socialProviders: {
      google: {
        clientId: options.googleClientId,
        clientSecret: options.googleClientSecret,
      },
    },
    session: { expiresIn: SESSION_MAX_AGE_SECONDS },
    trustedOrigins: ['https://greek.tools', 'http://localhost:4321'],
  });
}

export function createAuth(binding: D1Database, secret: string, options: CreateAuthOptions) {
  return createAuthForDb(createDb(binding), secret, options);
}

export type Auth = ReturnType<typeof createAuth>;
```

Update `createAuthForDb`'s callers in tests to supply dummy values for `googleClientId`, `googleClientSecret`, and `baseURL`.

### 2c. Update `src/pages/api/auth/[...all].ts`

Pass Google credentials and `baseURL` from the live request:

```typescript
import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';

export const prerender = false;

const handler: APIRoute = async ({ request, locals }) => {
  const { DB, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = locals.runtime.env;
  const auth = createAuth(DB, BETTER_AUTH_SECRET, {
    baseURL: new URL(request.url).origin,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
  });
  return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
```

### 2d. Remove `send_email` from `wrangler.jsonc`

Delete the entire `send_email` block — it is no longer used:

```jsonc
// Remove this:
"send_email": [
  {
    "name": "EMAIL",
    "allowed_sender_addresses": ["no-reply@greek.tools"]
  }
]
```

### 2e. Delete files that are no longer needed

```
src/lib/email.ts
src/pages/account/forgot-password.astro
src/pages/account/reset-password.astro
src/pages/api/auth/forgot-password.ts
src/pages/api/auth/reset-password.ts
src/pages/api/auth/signin.ts
src/pages/api/auth/signup.ts
src/pages/api/auth/_forgot-password.test.ts
src/pages/api/auth/_reset-password.test.ts
src/pages/api/auth/_signin.test.ts
src/pages/api/auth/_signup.test.ts
```

### 2f. Replace `src/pages/account/signin.astro`

Replace the email/password form with a "Continue with Google" button. The existing page already handles the `?from=` redirect param and the already-signed-in redirect — keep that logic.

Better Auth exposes a client-side `createAuthClient` factory (check the installed version of `better-auth` for the exact import — it is likely `better-auth/client`). The button triggers:

```typescript
authClient.signIn.social({
  provider: 'google',
  callbackURL: `/account/syncing?to=${encodeURIComponent(from || '/account')}`,
});
```

`from` is read from `new URLSearchParams(location.search).get('from')` in a `<script>` block.

The page no longer needs the `?error` or `?reset` query params — remove those handlers.

### 2g. Replace `src/pages/account/signup.astro`

There is no longer a distinct sign-up flow. Google OAuth creates the account on first sign-in. Replace this page's content with a redirect to `/account/signin`. A short note on the sign-in page is sufficient: "New? Just sign in with Google — your account will be created automatically."

### 2h. Handle new-user routing after OAuth

**The problem:** With email/password, `signup.ts` redirected new users to `/account/welcome` (import offer) while `signin.ts` redirected returning users to `/account/syncing` (pull-and-merge). With OAuth, both cases use the same `callbackURL`, so the routing must be determined at runtime.

**The solution:** Update `pullAndMerge()` in `src/lib/sync-manager.ts` to return whether the server had any prior data:

```typescript
async function pullAndMerge(): Promise<{ hadServerData: boolean }>
```

Update `src/pages/account/syncing.astro` to use this return value:

```typescript
const { hadServerData } = await pullAndMerge();
if (!hadServerData && hasLocalProgress()) {
  location.replace('/account/welcome');
} else {
  location.replace(dest);
}
```

This routes new users (no server data + local progress to offer) to the import flow and routes returning users straight to their destination. `hasLocalProgress()` is already exported from `sync-manager.ts`.

### 2i. Update `.github/workflows/greek-tools.yml`

Expand the "Set Cloudflare Worker secrets" step to include the Google credentials:

```yaml
- name: Set Cloudflare Worker secrets
  run: |
    echo "${{ secrets.BETTER_AUTH_SECRET }}" | pnpm wrangler secret put BETTER_AUTH_SECRET
    echo "${{ secrets.GOOGLE_CLIENT_ID }}" | pnpm wrangler secret put GOOGLE_CLIENT_ID
    echo "${{ secrets.GOOGLE_CLIENT_SECRET }}" | pnpm wrangler secret put GOOGLE_CLIENT_SECRET
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 2j. Update tests

The deleted files in 2e remove coverage for sign-in/sign-up/forgot-password/reset-password. Add a replacement integration test for the OAuth callback flow. Real Google OAuth cannot run in CI, so mock it:

- Better Auth's `[...all].ts` catch-all handles `GET /api/auth/callback/google` — write an integration test that simulates the callback with a mocked token exchange and asserts a `users` row is created and a session cookie is set
- Check Better Auth's testing utilities before writing a custom mock; they may provide a test OAuth server or helper

The existing `_signout.test.ts` and `_progress.test.ts` are unaffected and must continue to pass.

---

## 3. Verify locally before merging

```bash
cd apps/greek-tools
pnpm wrangler d1 migrations apply bible-language-tools --local
pnpm dev
```

Walk through:
1. Click "Continue with Google" on `/account/signin` — OAuth completes, lands on `/account`
2. Sign out — nav flips to "Sign in"
3. Visit `/account` while signed out — redirects to `/account/signin?from=/account`
4. Sign in again — sync runs, redirects to `/account`
5. Clear local storage, add some SRS cards manually, then sign in with a fresh account — import offer should appear at `/account/welcome`

Run tests and typecheck:

```bash
pnpm test:run
pnpm typecheck
```

---

## 4. Merge PR #57

Merging to main triggers the greek-tools workflow: tests → build → set secrets (BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) → apply migration `0001` → deploy.

```bash
gh run watch --repo mitchellpalermo/bible-language-tools
```

---

## 5. Verify in production (~5 minutes)

1. Go to https://greek.tools, study a few flashcards (so there's local progress), then click "Sign in" in the nav.
2. Click "Continue with Google" — complete the OAuth flow.
3. The import offer should appear at `/account/welcome` — choose **Import**, land on `/account`, confirm "Last synced just now".
4. Open the site in a private window, sign in with the same Google account — after the "Syncing…" page your cards should be present.
5. Sign out — nav flips back to "Sign in" everywhere, including static pages.
6. Confirm rows landed in D1 (Cloudflare dashboard → D1 → bible-language-tools): `users`, `accounts`, `sessions`, `srs_cards`, `sync_state`.

If anything misbehaves, Workers logs are live: Cloudflare dashboard → Workers → greek-tools → Logs.

---

## 6. Local development (when you next work on this)

```bash
# apps/greek-tools/.dev.vars has BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
cd apps/greek-tools
pnpm wrangler d1 migrations apply bible-language-tools --local
pnpm dev
# browse http://localhost:4321
```

Note: `http://localhost:4321` is fine for local dev. Better Auth uses non-secure cookies in dev mode. The `__Secure-` prefixed cookie concern only applies when previewing the production build via `pnpm wrangler dev --local-protocol https`.

---

## 7. GitHub OAuth (#56 feature 5.3) — when you decide to do it

Not implemented. Add only if sign-up data suggests meaningful demand. The pattern is identical to Google: register an OAuth app at github.com/settings/developers, add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to wrangler secrets and GitHub secrets, and add `github` to `socialProviders` in `src/lib/auth.ts`.

---

## 8. Loose ends (not blockers)

- **Coverage thresholds fail on `main` already** (62.8% statements vs. the 90% threshold). CI does not run coverage so nothing breaks, but `pnpm test:coverage` is red. The gap is mostly the Focus Passage components. Worth a tracking issue.
- **Root `CLAUDE.md` is stale**: still references `wrangler pages deploy`; both apps now deploy as Workers. Worth updating.
- **The home-directory git repo** (`/Users/mitch` is a git repo pointing at `hebrew-tools.git`, on branch `feat/accounts-phase-2-auth`) looks accidental. Worth cleaning up before it eats a `git clean` someday.
