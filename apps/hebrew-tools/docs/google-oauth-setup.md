# Google OAuth setup

One-time console configuration for sign-in. The code side is documented in
`CLAUDE.md`; this covers the parts that live in the Google Cloud console and
cannot be scripted.

ADR 005 (`apps/greek-tools/docs/adr/005-oauth-as-sole-auth-provider.md`) records
*why* OAuth is the only provider. This records *how* it is configured.

**Nothing in this file is a secret.** Redirect URIs appear in the browser
address bar during every sign-in, and OAuth client IDs are public by design —
Google transmits them in the URL on every authorization request. The one real
credential, the client secret, lives only in GitHub repo secrets and
`wrangler secret put`, and must never be written down here.

## Why the redirect URI has to be registered

When someone clicks "Continue with Google," we never see their password. The
flow is:

1. Our site redirects the browser to Google with our **client ID** and a
   **redirect URI** — the address Google should send the user back to.
2. Google authenticates them and redirects back to that URI carrying a
   short-lived **authorization code**.
3. Our Worker exchanges that code, plus the client secret, for the user's
   identity.

Step 2 is the dangerous one. The authorization code is a bearer credential —
whoever receives it can complete step 3 and log in as that user. If Google
honored any redirect URI an app asked for, an attacker could send a victim
through a link carrying our real client ID but pointing the return trip at their
own server, harvest the code, and take over the account.

Google prevents this by requiring every redirect URI to be **registered in
advance**. It is an exact-match allowlist — not a prefix, not a wildcard.

This is why the allowlist, not obscurity, is the control. Publishing the list
costs nothing; knowing what *is* allowed does not help anyone add something that
is not.

## Current configuration

A single OAuth client is shared by both apps, named **bible-language-tools** so
the consent screen does not tell a Hebrew student they are authorizing
"greek.tools." Both apps' deploy workflows read the same `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` repo secrets.

`baseURL` is derived from the request origin, so the callback is always
`<origin>/api/auth/callback/google` — Better Auth mounts at `/api/auth` (see
`src/pages/api/auth/[...all].ts`) and handles social callbacks at
`/callback/:provider`.

Registered redirect URIs:

| URI | For |
|---|---|
| `https://greek.tools/api/auth/callback/google` | greek.tools production |
| `https://hebrew.tools/api/auth/callback/google` | hebrew.tools production |
| `http://localhost:4321/api/auth/callback/google` | local `pnpm dev` |

## Adding a new origin

1. **console.cloud.google.com** → the project holding these credentials →
   **APIs & Services → Credentials**.
2. Open the OAuth 2.0 Client ID whose value matches the `GOOGLE_CLIENT_ID` repo
   secret. If there are several, it is the one already listing the URIs above.
3. Under **Authorized redirect URIs**, **Add URI**, then **Save**.
4. Check **APIs & Services → OAuth consent screen**. If **Publishing status** is
   *Testing*, only explicitly listed test users can sign in; everyone else gets
   `access_denied`.

Changes usually take effect immediately. Google's docs allow up to a few hours,
so wait before re-editing if it looks wrong right after saving.

### You do not need "Authorized JavaScript origins"

That field is a CORS allowlist for flows where the *browser* calls Google's
endpoints directly — the implicit flow, or the Google Identity Services library
(One Tap, the rendered Google button). We use neither. Better Auth's social
sign-in ends in `window.location.href = <google url>`, a top-level navigation
that CORS does not apply to, and the code exchange happens in the Worker.

This would change if the sign-in UI were ever swapped for One Tap or the
rendered Google button — both load `gsi/client` in the browser and would need
the origin registered.

Note the different format if you do add one: origins are scheme + host + port
with **no path**. `https://hebrew.tools` is valid; the full callback URL is not,
and Google's error will not make that obvious.

## Exact-match traps

All of these are *different* URIs and will be rejected:

- `https://www.hebrew.tools/...` — the `www.` subdomain
- `http://hebrew.tools/...` — http instead of https
- `https://hebrew.tools/api/auth/callback/google/` — trailing slash

**Local development must run on port 4321.** `baseURL` follows the request
origin, so `pnpm dev --port 4400` produces
`http://localhost:4400/api/auth/callback/google`, which is not registered, and
Google rejects it before any of our code runs.

## Verifying a registration

Paste this in a browser, substituting the real client ID:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=https%3A%2F%2Fhebrew.tools%2Fapi%2Fauth%2Fcallback%2Fgoogle&response_type=code&scope=openid%20email
```

- **A consent screen** → the URI is registered correctly.
- **`Error 400: redirect_uri_mismatch`** → not saved, or a character is off.

`src/lib/auth.test.ts` asserts the redirect URI Better Auth generates matches
the string registered above, so a config drift on our side fails in CI rather
than at a user's sign-in attempt. It cannot detect a change made in the Google
console — only this page and a real sign-in can.

## Failure modes

| Symptom | Cause |
|---|---|
| `Error 400: redirect_uri_mismatch` | URI not registered, or an exact-match trap above |
| `access_denied` for most users | Consent screen still in *Testing* |
| Sign-in works locally, fails in production | Only the localhost URI was added |
| Sign-in works in production, fails locally | Dev server not on port 4321 |
| 500 from `/api/auth/*` | Worker secrets missing — check the deploy workflow's secret step |
