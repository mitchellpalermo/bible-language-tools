# Feature Spec: User Accounts and Cross-Device Sync

**Decision record:** `docs/adr/003-accounts-and-cross-device-sync.md`  
**Stack:** Better Auth + Cloudflare D1 + Drizzle ORM  
**Sync strategy:** Local-first with server sync (Option B)

---

## Overview

Five sequential implementation phases. Each phase is independently deployable and testable. Do not start a phase until the preceding one is working in production.

---

## Phase 1 — D1 + Drizzle Schema

Goal: provision the database, define the schema, and validate the data model end-to-end before any auth or UI work.

### Features

**1.1 — D1 database provisioning**
- Create a D1 database via wrangler (`wrangler d1 create greek-tools`)
- Add the database binding to `wrangler.jsonc` under `[[d1_databases]]`
- Add a local dev binding so `pnpm dev` uses a local SQLite instance (wrangler `--local`)
- Add a test binding for Vitest (in-memory or separate test DB)

**1.2 — Drizzle schema**
- Install `drizzle-orm` and `drizzle-kit`; add `drizzle.config.ts`
- Define the following tables in `src/db/schema.ts`:

  | Table | Columns |
  |-------|---------|
  | `users` | `id` (text PK), `email` (text unique), `created_at` (integer — Unix ms) |
  | `sessions` | `id` (text PK), `user_id` (FK → users), `expires_at` (integer) — managed by Better Auth in Phase 2; define shape now |
  | `srs_cards` | `user_id` (FK), `word_key` (text), `interval` (integer), `repetition` (integer), `ease_factor` (real), `due_date` (text YYYY-MM-DD), `last_reviewed` (text), PK(`user_id`, `word_key`) |
  | `study_stats` | `user_id` (FK PK), `streak` (integer), `last_streak_date` (text), `cards_studied_today` (integer), `last_study_date` (text), `total_reviewed` (integer), `total_correct` (integer) |
  | `custom_decks` | `id` (text PK), `user_id` (FK), `name` (text), `word_keys` (text — JSON array), `created_at` (text ISO) |

- Generate and commit the initial migration file via `drizzle-kit generate`
- Run migrations locally via `drizzle-kit migrate` and confirm tables exist in the local D1 instance

**1.3 — TypeScript alignment**
- Confirm that `InferSelectModel<typeof srsCards>` is assignable to the existing `SRSCard` interface (or document any mismatches and resolve them)
- Export a `db` helper from `src/db/index.ts` that accepts a `D1Database` binding and returns a Drizzle instance

**1.4 — Smoke test**
- Write a Vitest integration test that exercises the `db` helper against a real in-memory SQLite instance: insert an `srs_card` row, read it back, assert equality
- This test is the signal that the schema compiles, the migration runs, and the ORM types are correct — no auth or API work yet

---

## Phase 2 — Better Auth (email/password)

Goal: users can create an account, sign in, and sign out. Session is available server-side in Astro middleware and client-side in React islands.

### Features

**2.1 — Better Auth installation and configuration**
- Install `better-auth` and `@better-auth/drizzle`
- Configure in `src/lib/auth.ts`: D1 adapter, `emailAndPassword` plugin enabled, session expiry 30 days, cookie name `greek-tools-session`
- Add `AUTH_SECRET` to wrangler secrets (and to `.dev.vars` locally)
- Expose the Better Auth handler at `src/pages/api/auth/[...all].ts` (catch-all route)

**2.2 — Astro middleware for session**
- Add `src/middleware.ts` that reads the session cookie on every request
- Attach `locals.user` (`{ id, email } | null`) so all Astro pages have access without a round-trip
- No redirect logic here — pages decide whether to gate themselves

**2.3 — Sign-up page (`/account/signup`)**
- Email + password form (password min 8 chars)
- Client-side validation before submit; server-side validation returns field-level errors
- On success: redirect to `/account`
- Show inline error for duplicate email ("An account with that email already exists")
- No OAuth options yet — email/password only

**2.4 — Sign-in page (`/account/signin`)**
- Email + password form
- On success: redirect to `/account` (or the `?from=` redirect param if present)
- Generic error message on failure ("Email or password is incorrect") — do not distinguish between "email not found" and "wrong password"
- "Forgot password" link — placeholder only in this phase (no email sending yet)

**2.5 — Sign-out**
- `POST /api/auth/signout` endpoint (handled by Better Auth catch-all)
- Sign-out button on the account page that submits this form
- On success: redirect to `/`

**2.6 — Account page (`/account`)**
- Gated: redirect to `/account/signin?from=/account` if no session
- Displays: signed-in email, account created date
- Contains: sign-out button (from 2.5)
- Sync status section: placeholder only — "Sync not configured yet" — to be filled in Phase 4

**2.7 — Nav integration**
- Header shows "Sign in" link when logged out
- Header shows account avatar/initial and dropdown when logged in (sign out option)
- This is the only visual change to existing pages in this phase

**2.8 — Tests**
- Unit: Better Auth configuration validates (correct adapter, correct plugin list)
- Integration: sign-up flow creates a `users` row; sign-in returns a valid session cookie; sign-out clears it
- E2E: Playwright test covers sign-up → account page → sign-out → redirected to home

---

## Phase 3 — Sync API Endpoints

Goal: two authenticated API endpoints that read and write a user's full progress. No client-side wiring yet — validate correctness via direct API calls.

### Features

**3.1 — Shared progress types**
- Define `ProgressPayload` in `src/lib/sync-types.ts`:
  ```ts
  interface ProgressPayload {
    srsStore: Record<string, SRSCard>;    // same shape as localStorage
    studyStats: StudyStats;               // same shape as localStorage
    customDecks: CustomDeck[];            // same shape as localStorage
    syncedAt: string;                     // ISO timestamp, server-assigned on write
  }
  ```
- This type is the contract between client and server. It maps 1:1 to the existing localStorage shapes so no client-side conversion is needed.

**3.2 — `GET /api/progress`**
- Requires an authenticated session (401 if missing)
- Reads `srs_cards`, `study_stats`, and `custom_decks` for `locals.user.id`
- Assembles and returns a `ProgressPayload`
- Returns `200 { data: ProgressPayload }` or `200 { data: null }` if the user has no server-side progress yet (new account, never synced)

**3.3 — `PUT /api/progress`**
- Requires an authenticated session (401 if missing)
- Accepts a `ProgressPayload` in the request body
- Validates: `srsStore` is a non-null object, `studyStats` has required fields, `customDecks` is an array
- Upserts all rows: replaces the user's `srs_cards` in bulk (delete + insert in a transaction), upserts `study_stats`, replaces `custom_decks`
- Returns `200 { syncedAt: string }`
- Rejects oversized payloads: body > 512 KB → 413

**3.4 — Auth middleware on API routes**
- Extract session from cookie in both endpoints
- Return `401 { error: 'Unauthorized' }` if session is missing or expired
- Do not leak whether the session expired vs. was never set

**3.5 — Tests**
- Unit: `GET` with no prior progress returns `{ data: null }`; `PUT` followed by `GET` round-trips the payload exactly
- Unit: `PUT` with an oversized payload returns 413
- Unit: both endpoints return 401 when called without a session
- Unit: `PUT` is transactional — if the `custom_decks` insert fails, `srs_cards` changes are rolled back

---

## Phase 4 — Client-Side Sync Wiring

Goal: sync runs automatically. Users don't think about it.

### Features

**4.1 — `syncManager` module (`src/lib/sync-manager.ts`)**
- `pullAndMerge()` — calls `GET /api/progress`, merges server state with local localStorage state using the merge rules below, writes merged result back to both localStorage and server via `PUT /api/progress`
- `push()` — reads current localStorage state, calls `PUT /api/progress`, updates the `lastSyncedAt` timestamp in localStorage
- `getLastSyncedAt()` / `setLastSyncedAt()` — localStorage key `greek-tools-last-synced`
- All network errors are caught and logged silently; sync failure must never interrupt a study session

**4.2 — Merge rules (implemented in `src/lib/sync-merge.ts`)**
- SRS store: for each word key present in either store, take the entry with the higher `repetition`. If equal, take the later `dueDate`.
- StudyStats: `streak` = max of both; `totalReviewed` = max of both; `totalCorrect` = max of both; `cardsStudiedToday` and `lastStudyDate` = take the entry from the store with the higher `totalReviewed` (as a proxy for the most recently active device)
- CustomDecks: union by deck `id`; for duplicate IDs, last-write-wins (compare `createdAt`)
- These rules are pure functions — no side effects, fully testable

**4.3 — Sync on login**
- After a successful sign-in, call `pullAndMerge()` before redirecting to the destination page
- Show a brief "Syncing..." state during the pull; redirect only after it resolves (or after a 5-second timeout if the network is slow)

**4.4 — Sync on session end**
- Register a `visibilitychange` listener in the root layout: when `document.visibilityState === 'hidden'`, call `push()` via `navigator.sendBeacon` if available, otherwise `fetch` with `keepalive: true`
- This fires when the user switches tabs, minimizes the browser, or navigates away

**4.5 — Manual sync trigger**
- "Sync now" button on the `/account` page
- Calls `pullAndMerge()` on click
- Button shows loading state during sync; shows "Last synced: [relative time]" on completion
- Shows an error message if sync fails (the only place sync failure is surfaced to the user)

**4.6 — New account import flow**
- After sign-up (not sign-in), before redirecting to `/account`: check if localStorage contains any SRS cards with `repetition > 0` or any custom decks
- If yes: show a modal/step — "You have existing study progress. Import it to your account?" with "Import" and "Start fresh" options
- "Import" calls `push()` with the current localStorage state as the initial server state
- "Start fresh" calls `DELETE /api/progress` (add this endpoint) to ensure the server starts empty, then redirects
- This step only runs once per account creation — track with a `greek-tools-import-offered` localStorage flag

**4.7 — Sync status in the UI**
- `LastSynced` component displayed on the `/account` page: "Last synced 2 minutes ago" / "Never synced" / "Sync failed — try again"
- No sync indicator on study pages — sync is invisible during a session

**4.8 — Tests**
- Unit: all merge rules (`src/lib/sync-merge.test.ts`) — cover higher repetition wins, equal repetition with later dueDate, deck union, stats max
- Unit: `pullAndMerge` with mocked fetch — asserts correct merge + write behavior
- Unit: `push` with mocked fetch — asserts full payload sent
- Unit: network error in `push` does not throw (silent failure)
- Integration: sign up with localStorage data → import flow → `GET /api/progress` returns the imported data
- E2E: sign in on device A, study 5 cards, sign out, sign in on device B, assert those 5 cards are present in localStorage

---

## Phase 5 — OAuth Providers

Goal: users can sign in with Google (and optionally GitHub) without managing a password. Implement only when there is evidence that email/password friction is reducing sign-ups.

### Features

**5.1 — Google OAuth**
- Register a Google OAuth app; add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to wrangler secrets
- Add the `google` social provider to Better Auth config
- Add "Continue with Google" button to both `/account/signin` and `/account/signup`
- On first Google sign-in: create a new `users` row (no password set); run the same import flow as Phase 4.6
- On subsequent Google sign-ins: normal sign-in flow

**5.2 — Account linking (email + OAuth)**
- If a user signed up with email/password and later tries Google sign-in with the same email: prompt "This email is already registered. Sign in with your password to link your Google account"
- After password confirmation, link the Google identity to the existing account
- Linked accounts show both sign-in methods on `/account`

**5.3 — GitHub OAuth (optional)**
- Same pattern as Google. Lower priority; add only if user research suggests demand.

**5.4 — Tests**
- Integration: Google OAuth flow with mocked OAuth server — assert user row created, session returned
- Integration: duplicate email linking flow — assert single user row, both credentials work
- E2E: not feasible with a real OAuth provider — mock the OAuth callback in Playwright

---

## What is explicitly out of scope

- Password reset via email (requires an email sending service — deferred indefinitely)
- Team/shared accounts
- Admin dashboard
- Data export (the `GET /api/progress` endpoint already serves this need)
- Deleting an account (add only if legally required)
