# Sign in with Apple setup

One-time configuration in the Apple Developer portal (developer.apple.com →
Certificates, Identifiers & Profiles). The code side is
`@tools/shared/apple-sign-in` and each app's `src/lib/auth.ts`; this covers the
parts only the account holder can do.

**Until all four secrets below are set, nothing changes on either site.** Each
app reads the four values at request time, and with any of them missing it shows
no Apple button and registers no Apple provider. So the code can merge first.

**The private key is the one real secret.** It goes into GitHub repo secrets (or
the Worker's settings in Cloudflare) and nowhere else: not in this repository,
not in an issue, not in a chat.

## How it differs from Google

- **Apple has no fixed client secret.** We sign a short-lived JWT (JSON Web
  Token) with the `.p8` key Apple issues. The Worker signs one the first time it
  needs it and reuses it for up to 30 days, so there is nothing to renew by hand.
- **Apple answers with a cross-site form POST** (`response_mode=form_post`) from
  `https://appleid.apple.com`. Better Auth turns it into a same-site GET, and the
  auth config trusts that origin only while Apple is configured. Astro's own
  cross-site form check would refuse the POST before Better Auth saw it, so it
  is off in both apps and the middleware runs the same check with this one
  callback exempt (`@tools/shared/origin-check`).
- **Apple sends the name once**, on a person's first Apple sign-in. Better Auth
  stores it then; later sign-ins carry only the email.
- **"Hide My Email"** gives us an `…@privaterelay.appleid.com` address. We send
  no email, so no relay setup is needed. A relay address does not match a
  person's Google email, so it signs in to a separate account (see "Known gap").
- **No localhost.** Apple accepts only `https` return URLs on a real domain, so
  Apple sign-in cannot be tried under `pnpm dev`. Google still can.

## Steps

1. **Team ID.** Membership details (top right of the portal). Ten characters.
2. **App ID.** Identifiers → `+` → App IDs → App. Pick a reverse-domain
   identifier (for example `tools.bible`), and tick **Sign in with Apple**.
   Nothing ships to the App Store; Apple needs an App ID to hang the web sign-in on.
3. **Services ID.** Identifiers → `+` → Services IDs. Its identifier (for example
   `tools.bible.signin`) is the OAuth client ID. Tick **Sign in with Apple** →
   **Configure**:
   - Primary App ID: the one from step 2.
   - Domains and Subdomains: `greek.tools`, `hebrew.tools`
   - Return URLs (exact match):
     - `https://greek.tools/api/auth/callback/apple`
     - `https://hebrew.tools/api/auth/callback/apple`
4. **Key.** Keys → `+`. Tick **Sign in with Apple** → **Configure** → the App ID
   from step 2. Download the `.p8` file (Apple lets you download it once) and
   note the **Key ID**.
5. **Secrets.** GitHub → the repository → Settings → Secrets and variables →
   Actions → New repository secret, one each:

   | Secret | Value |
   |---|---|
   | `APPLE_CLIENT_ID` | The Services ID from step 3 (not the App ID) |
   | `APPLE_TEAM_ID` | The Team ID from step 1 |
   | `APPLE_KEY_ID` | The Key ID from step 4 |
   | `APPLE_PRIVATE_KEY` | The whole `.p8` file, `BEGIN` and `END` lines included |

   Both apps' deploy workflows read the same four, and push each one to the
   Worker with `wrangler secret put` when it is set. A deploy runs only when a
   change to that app reaches `main`, so set them before merging the change that
   added Apple (it touches `packages/shared`, so its merge deploys both apps).
   Setting them directly on each Worker in the Cloudflare dashboard also works
   and takes effect at once; the workflow skips an unset GitHub secret rather
   than clearing the Worker's.

## Checking it

After the next deploy, `/account/signin` on each site shows **Continue with
Apple** under Google. If the button shows but Apple reports `invalid_client`,
the Services ID or a return URL does not match step 3. If it reports
`invalid_request` about the redirect, a return URL is missing. A key that will
not import is logged by the Worker and leaves Apple off; Google keeps working.

## Known gap

A person who signed up with Google and later picks Apple with "Hide My Email"
gets a second, empty account, because the two emails differ. When the emails
match, Better Auth links the two sign-ins to one account. A "Link Apple" button
on the account page (Better Auth's `linkSocial`) would close the gap; it is not
built yet.
