# Cross-device sync — manual test plan

Unit tests cover the merge rules and the database layer. What they cannot cover
is a real signed-in session across two real browsers, which is where sync
actually breaks. This plan is that gap.

Work through it against a deployed build, not `pnpm dev` — the session cookie,
the OAuth round trip, and keepalive pushes all behave differently locally.

## Before you start: how sync actually fires

There are exactly three moments progress moves, and knowing which is which
explains almost every surprising result:

| Trigger | Operation | Direction |
|---|---|---|
| Sign-in (`/account/syncing`) | `pullAndMerge()` | server → merge → both |
| "Sync now" on `/account` | `pullAndMerge()` | server → merge → both |
| Tab hidden (any page, signed in) | `push()` | **local → server, no merge** |

The third one is a **blind overwrite**. `push()` sends this browser's
localStorage as-is, and the server replaces the whole per-language row set with
it. Nothing pulls on ordinary page load — only on sign-in and on "Sync now."

That asymmetry is the source of most of the risk below. Tests 10 and 11 target
it directly.

## Setup

- Two independent browser profiles — ideally two physical devices, but two
  Chrome profiles work for everything except the mobile tab-bar cases. Call them
  **A** and **B**.
- Sign in to the **same Google account** on both.
- Keep DevTools → Console open on each.

### Inspecting state

**Local**, in the console:

```js
copy(JSON.stringify({
  srs: JSON.parse(localStorage.getItem('hebrew-tools-srs-v1') || '{}'),
  stats: JSON.parse(localStorage.getItem('hebrew-tools-stats-v1') || '{}'),
  lastSynced: localStorage.getItem('hebrew-tools-last-synced'),
}, null, 2))
```

**Server** — visit `https://hebrew.tools/api/progress` in a signed-in tab. It
returns the raw payload, or `{"data":null}` if the account has never synced.

**Both side by side** — the workhorse for this plan:

```js
(async () => {
  const local = JSON.parse(localStorage.getItem('hebrew-tools-srs-v1') || '{}');
  const server = (await (await fetch('/api/progress')).json()).data;
  console.table(Object.keys({ ...local, ...server?.srsStore }).map((w) => ({
    word: w,
    local_rep: local[w]?.repetition ?? '—',
    server_rep: server?.srsStore?.[w]?.repetition ?? '—',
    local_due: local[w]?.dueDate ?? '—',
    server_due: server?.srsStore?.[w]?.dueDate ?? '—',
  })));
})()
```

**Ground truth in D1**, if you ever distrust the API:

```bash
pnpm wrangler d1 execute bible-language-tools --remote \
  --command "SELECT language, word_key, repetition, due_date FROM srs_cards ORDER BY language, word_key"
```

### Seeding a known state

Studying real cards is slow and non-deterministic. For merge tests, set the
store directly, then reload:

```js
localStorage.setItem('hebrew-tools-srs-v1', JSON.stringify({
  'מֶלֶךְ': { key:'מֶלֶךְ', interval:6,  repetition:3, easeFactor:2.5, dueDate:'2026-09-01', lastReviewed:'2026-08-08' },
  'דָּבָר': { key:'דָּבָר', interval:1,  repetition:1, easeFactor:2.5, dueDate:'2026-08-09', lastReviewed:'2026-08-08' },
}));
```

Reset a device completely:

```js
Object.keys(localStorage).filter(k => k.startsWith('hebrew-tools-')).forEach(k => localStorage.removeItem(k));
```

---

## Tests

### 1. First sign-in with local progress — the import offer

**Why:** the riskiest moment for a real user. They have weeks of anonymous
study and are about to attach it to an account.

1. On **A**, signed out, study 10+ cards so several have `repetition > 0`.
2. Record the local state.
3. Sign in.

**Expect:** you pass through "Syncing your study progress…", land on
**"Import your progress?"**, and choosing **Import** returns you to `/account`.
Server now shows the same cards as local. Nothing lost.

**Watch for:** landing straight on `/account` without the offer. That means
`hasLocalProgress()` returned false — check that some card has `repetition > 0`,
not just that cards exist.

### 2. First sign-in with no local progress

1. Fresh profile, sign in without studying.

**Expect:** no import offer; straight to `/account`. Server returns
`{"data":null}` until something is pushed.

### 3. Second device pulls existing progress

1. With test 1 done on **A**, sign in on **B** (fresh, no local progress).

**Expect:** **B**'s localStorage now contains A's cards. No import offer on B —
the server had data, so `hadServerData` was true.

### 4. Divergent study — the core case

1. **A** and **B** both synced and identical.
2. On **A**, study 5 cards; do *not* touch B.
3. On **A**, click **Sync now**.
4. On **B**, study 5 *different* cards.
5. On **B**, click **Sync now**.

**Expect:** B ends with **all 10** cards. Then Sync now on A → A also has all 10.

**Watch for:** either set vanishing. That's the failure this whole feature
exists to prevent.

### 5. Same card, both devices — more progress wins

1. Seed **A** with `מֶלֶךְ` at `repetition: 1`, **B** at `repetition: 5`.
2. Sync A, then sync B, then sync A again.

**Expect:** both settle on **5**. Order of syncing must not change the answer —
the merge is symmetric by design.

### 6. Repetition tie — later due date wins

1. Seed both with `מֶלֶךְ` at `repetition: 3`, but `dueDate: '2026-08-10'` on A
   and `'2026-09-01'` on B.
2. Sync both.

**Expect:** `2026-09-01` survives on both.

### 7. Stats merge

1. On **A**, seed `hebrew-tools-stats-v1` with `streak: 9`,
   `lastStreakDate: '2026-08-07'`, `totalReviewed: 200`.
2. On **B**, seed `streak: 2`, `lastStreakDate: '2026-06-01'`,
   `totalReviewed: 40`.
3. Sync both.

**Expect:** `streak: 9` **paired with** `lastStreakDate: '2026-08-07'`, and
`totalReviewed: 200`.

**Watch for:** streak 9 alongside B's June date. A mismatched pair makes the
next review compute the streak break wrongly — the streak silently resets days
later, far from the cause.

### 8. Start fresh

1. Fresh profile **C**, study a few cards signed out, sign in, choose
   **Start fresh**.

**Expect:** server progress deleted *and* C's localStorage cleared. Reload — no
cards. Then on **A**, Sync now: A still has its own local progress and pushes it
back up.

**Watch for:** C's local progress surviving. If it does, the next tab-hide push
re-uploads exactly what the user chose to discard.

### 9. Large deck — insert chunking

**Why:** D1 caps bound parameters at 100/statement, so cards insert 12 at a
time. Off-by-one in chunking only shows up above the boundary.

1. Seed **A** with 40+ cards (loop the seed snippet).
2. Sync now, then check the server.

**Expect:** all 40 present, values intact. Spot-check the last one.

### 10. Stale device overwrite — **the one I most want probed**

**Why:** `push()` on tab-hide is a blind overwrite. This test asks whether that
can destroy another device's work.

1. Get **A** and **B** both signed in and synced identically.
2. On **B**, close the tab and leave it alone.
3. On **A**, study 10 cards. Wait for a tab-hide push (switch tabs) or click
   **Sync now**. Confirm the server has A's 10.
4. On **B**, open hebrew.tools — **do not sign in again, do not click Sync now**
   (B is already signed in, so no pull happens).
5. On **B**, switch to another tab to trigger the session-end push.
6. Check the server.

**Expect (honest prediction):** the server now holds **B's stale state**, and
A's 10 reviews are gone from it.

**Is that data loss?** Usually not permanently — A's localStorage still has
them, so A's next sync merges them back. It becomes real loss only if A's
browser data is cleared, or A never returns, or a *third* device pulls in
between and propagates the stale state.

**Record what you observe.** If it behaves as predicted, that's a design gap to
fix, not a mystery — see "Known gap" below. greek.tools has the identical
behavior today, so it isn't a regression this PR introduces.

### 11. Timed-out sync reaching the import offer

**Why:** a plausible route to the same overwrite through the UI.

1. On a **fresh profile** for a **returning** account (one that already has
   server progress), study a few cards signed out.
2. Sign in with the network throttled hard (DevTools → Network → Slow 3G) so
   `/account/syncing` hits its 5s timeout.

**Expect:** the timeout treats the account as having no server data. If the
import offer appears and you click **Import**, that pushes only this browser's
few cards — overwriting the account's real history.

**Record what happens.** If the offer appears here, the fix is to distinguish
"server has no data" from "we could not reach the server."

### 12. Failure never interrupts studying

1. On **A**, go offline (DevTools → Network → Offline).
2. Study 10 cards, flipping and grading normally.

**Expect:** studying works exactly as normal. No error, no stall. Progress saves
to localStorage.

3. Go back online, click **Sync now**.

**Expect:** "Last synced just now", and the offline reviews reach the server.

4. While offline, click **Sync now** directly.

**Expect:** "Sync failed — try again". No crash, no lost local state.

### 13. Sign-out

1. On **A**, sign out.

**Expect:** nav flips to "Sign in", `/account` redirects to sign-in, and
**localStorage progress survives** — signing out is not a reset. Studying still
works signed out.

### 14. Import offered once per account, not once per browser

1. On **A**, sign out, then sign in again.

**Expect:** no second import offer.

2. Sign in with a **different** Google account in the same browser.

**Expect:** the offer *does* appear — the flag is keyed
`hebrew-tools-import-offered:<userId>`.

### 15. greek.tools isolation — **run this every time**

**Why:** one database backs both apps. An unscoped query would silently corrupt
greek.tools, and greek has real study history in it.

1. Before starting, on greek.tools: sign in with the same Google account, note
   your card count and streak.
2. Run every test above.
3. Return to greek.tools, **Sync now**, and re-check.

**Expect:** greek.tools is byte-for-byte unaffected.

Direct check:

```bash
pnpm wrangler d1 execute bible-language-tools --remote \
  --command "SELECT language, COUNT(*) FROM srs_cards GROUP BY language"
```

Hebrew activity must never change the greek count.

---

## Known gap: blind push on tab-hide

Tests 10 and 11 probe the same underlying issue. `registerSessionEndPush` calls
`push()`, not `pullAndMerge()`, and `putProgress` replaces the full per-language
row set. A device with stale local state can therefore overwrite newer
server-side progress.

It is mitigated in practice — each device keeps its own localStorage, so the
next merge usually restores what was overwritten — but it is not airtight.

Three possible fixes, if testing confirms it matters:

1. **Guard server-side.** Reject a `PUT` whose payload is strictly smaller than
   what is stored (fewer cards *and* lower `totalReviewed`), or merge on the
   server instead of replacing. Cheapest, and closes the hole regardless of
   which client is at fault.
2. **Pull on load, not just on sign-in.** A signed-in page load does a
   `pullAndMerge()` before any push can fire. Costs a request per session.
3. **Make the session-end push a merge.** Cleanest conceptually, but keepalive
   is one-shot and cannot do a reliable round trip during unload.

I would take (1). It is the only one that holds even when a client misbehaves.

## Reporting

For anything surprising, capture:

- which device, and what the other device's state was at the time
- the side-by-side `console.table` output from both devices
- the raw `/api/progress` response
- which of the three sync triggers fired

The trigger is the part that is easiest to lose track of and most often explains
the result.
