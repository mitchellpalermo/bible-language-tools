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
| Tab hidden (any page, signed in) | `push()` | local → server, no client-side merge |

The third sends this browser's localStorage as-is — it is a one-shot keepalive
request and cannot pull first. Nothing pulls on ordinary page load either, only
on sign-in and "Sync now."

**The server merges on write**, which is what makes that safe. `PUT
/api/progress` merges the incoming payload into what is stored rather than
replacing it, so a stale push can only ever add or hold — never regress another
device's work. Tests 10 and 11 exist to confirm that in the real world.

**Corollary: `PUT` can never remove a card.** Deletion goes through `DELETE`
only, which is what "Reset SRS" and the "Start fresh" option call. Test 8 and
test 16 cover those paths.

## Setup

- Two independent browser profiles — ideally two physical devices, but two
  Chrome profiles work for everything except the mobile tab-bar cases. Call them
  **A** and **B**.
- Sign in to the **same Google account** on both.
- Keep DevTools → Console open on each.

**Verify the accounts match before anything else.** Sync is per-account, so two
devices on different Google logins share nothing and every cross-device test
silently measures nothing:

```bash
cd apps/hebrew-tools
pnpm wrangler d1 execute bible-language-tools --remote \
  --command "SELECT u.email, COUNT(*) AS cards FROM srs_cards c JOIN users u ON u.id = c.user_id WHERE c.language='hebrew' GROUP BY u.email"
```

More than one row means more than one account has Hebrew progress. Pick one and
make sure both devices are on it. This bit us on the first run — a personal and
a student Google account, and the symptom was duplicate `word_key` rows in an
unscoped query rather than anything that looked like an account problem.

**Study mode matters.** "Study All" is a cram mode: `handleReview` only writes to
the SRS store when the mode is `srs` (see `Flashcards.tsx`). Grading cards in
Study All moves the stats but creates **no cards**, so any test below that says
"study N cards" means **SRS Review** mode. Verify before relying on it:

```js
Object.values(JSON.parse(localStorage.getItem('hebrew-tools-srs-v1') || '{}'))
  .filter(c => c.lastReviewed === new Date().toISOString().slice(0,10)).length
```

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

**Ground truth in D1**, if you ever distrust the API. **Scope it to one account** —
an unscoped query pools every user's rows together and produces what look like
impossible duplicate `word_key`s:

```bash
cd apps/hebrew-tools
pnpm wrangler d1 execute bible-language-tools --remote \
  --command "SELECT c.word_key, c.repetition, c.due_date FROM srs_cards c JOIN users u ON u.id = c.user_id WHERE c.language='hebrew' AND u.email='YOUR_EMAIL' ORDER BY c.word_key"
```

> **wrangler needs a TTY.** It refuses the interactive OAuth flow when stdout is
> not a terminal, so `| grep`, `> file`, and `--json` all fail with "In a
> non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN" —
> and a redirect swallows the error, leaving a silent 0-byte file. Run these
> plain and read the table, or set `CLOUDFLARE_API_TOKEN` in your environment,
> or wrap with `script -q /dev/null <cmd> | tr -d '\r'` to fake a terminal.

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

1. On **A**, signed out, study 10+ cards **in SRS Review mode** so several have
   `repetition > 0`. (Study All writes no cards — see Setup.)
2. Record the local state.
3. Sign in.

**Expect:** you pass through "Syncing your study progress…", land on
**"Import your progress?"**, and choosing **Import** returns you to `/account`.
Server now shows the same cards as local. Nothing lost.

**Watch for:** landing straight on `/account` without the offer. That means
`hasLocalProgress()` returned false — check that some card has `repetition > 0`,
not just that cards exist.

Mitch: This works on mobile. Desktop seems to have bypassed the "Import your progress" offer. Maybe I didn't have any progress? 

Moving on to the next one. 

**Result — 2026-08-08 (PASS on mobile; desktop behaviour explained, not a defect)**

Desktop most likely took the *test 3* path rather than skipping anything. Mobile
imported first, so the server then had data; desktop's sign-in got
`hadServerData: true`, which routes straight to the destination and never
renders `/account/welcome`. The offer only appears when the server has nothing
**and** this device has a card with `repetition > 0`.

The alternative — desktop genuinely having no graded cards — is also consistent
with what was seen. To tell them apart on a future run, check
`localStorage['hebrew-tools-srs-v1']` for any `repetition > 0` *before* signing
in. Either way the code behaved correctly.

### 2. First sign-in with no local progress

1. Fresh profile, sign in without studying.

**Expect:** no import offer; straight to `/account`. Server returns
`{"data":null}` until something is pushed.

I think this is probably what just happened?


### 3. Second device pulls existing progress

1. With test 1 done on **A**, sign in on **B** (fresh, no local progress).

**Expect:** **B**'s localStorage now contains A's cards. No import offer on B —
the server had data, so `hadServerData` was true.

### 4. Divergent study — the core case

1. **A** and **B** both synced and identical.
2. On **A**, study 5 cards **in SRS Review mode**; do *not* touch B.
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

1. Fresh profile **C**, study a few cards signed out **in SRS Review mode**, sign in, choose
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

### 10. Stale device push — **the one I most want probed**

**Why:** the session-end push sends stale local state with no client-side merge.
Server-side merge is what should make that harmless. This test proves it against
a real deployment rather than against SQLite in a test runner.

1. Get **A** and **B** both signed in and synced identically.
2. On **B**, close the tab and leave it alone.
3. On **A**, study 10 cards **in SRS Review mode**. Wait for a tab-hide push (switch tabs) or click
   **Sync now**. Confirm the server has A's 10.
4. On **B**, open hebrew.tools — **do not sign in again, do not click Sync now**
   (B is already signed in, so no pull happens).
5. On **B**, switch to another tab to trigger the session-end push.
6. Check the server.

**Expect:** the server still holds **all** of A's 10 reviews. B's stale push
merged in and changed nothing, because merging happens server-side.

**This is the failure mode to hunt for.** If A's reviews disappear from the
server here, the server-side merge is not doing its job and nothing else in this
plan matters. Capture the `/api/progress` response before and after B's push.

**Then confirm the reverse:** study 3 cards on B **in SRS Review mode**, hide the tab, and check that
those 3 *do* appear on the server. A guard that blocks stale data is only
correct if it still lets new data through.

> greek.tools still replaces rather than merges on write, so it has the original
> behaviour. Worth porting this fix there — see the note in issue #91.

**Result — 2026-08-08, against production (PASS)**

Setup: server held 24 cards for the test account, one of them `דָּבָר` at
`repetition: 1, dueDate: 2026-08-08`. Device B was seeded with a deliberately
stale **2-card** store — `דָּבָר` regressed to `repetition: 0, dueDate:
2026-08-01`, plus `מֶלֶךְ` which the server had never seen — then B's tab was
hidden to fire the keepalive push. Device A was closed throughout.

| Check | Result |
|---|---|
| Rows lost | **0** — all 24 survived a push containing 2 cards |
| Rows regressed | **0** — `דָּבָר` held at `repetition: 1` |
| Rows added | **1** — `מֶלֶךְ` at the stale values |

All three properties confirmed at once:

1. **Nothing deleted.** Under the previous replace-on-write behaviour the server
   would have been left holding exactly B's 2 cards, losing 22.
2. **Nothing regressed.** `דָּבָר` was the trap: B pushed it strictly behind the
   stored row, and "higher repetition wins" held.
3. **New data still landed.** `מֶלֶךְ` was absent server-side, so a stale device's
   unknown card is new information, not a regression — and it was accepted. This
   is what distinguishes a correct guard from one that simply rejects everything
   from a behind-the-times client. A blanket rejection would also have shown
   "0 rows lost" and would have been wrong.

**Second half — same session (PASS)**

Studied more cards on B in SRS Review mode and hid the tab again. Compared
against the 25-row state above:

| Check | Result |
|---|---|
| Rows lost | **0** |
| Rows regressed | **0** |
| Rows added | **9** new cards |
| Existing rows advanced | **1** — `מֶלֶךְ` |

`מֶלֶךְ` is the one that matters. It was the stale card B had pushed at
`repetition: 0, dueDate: 2026-08-01`. Studying it moved local to
`dueDate: 2026-08-09` with `repetition` still 0, so repetitions tied and the
merge fell through to "later `dueDate` wins" — which it did. That closes the gap
the first half left open: not just new *keys*, but new *reviews on existing
keys*, flow through the guard.

It also exercises test 6's tie-break rule against production for free.

**Caveat on the data used.** Grading "Still Learning" (quality 1) resets
`repetition` to 0 and sets a 1-day interval, so a run where everything is marked
"Still Learning" only ever exercises the **dueDate tie-break**, never the "higher
repetition wins" branch. Only `דָּבָר` reached `repetition: 1` here. To confirm
that branch against production, use test 5's seeded values or mark some cards
"Got It".

**Diffing this output.** Hebrew combining marks may normalize differently between
two captures, so `sort`/`comm`/`diff` can report nonsense — words that are
plainly present get flagged as added. Compare with NFC normalization applied:

```python
import unicodedata as ud
key = ud.normalize('NFC', word_key)
```

### 11. Timed-out sync reaching the import offer

**Why:** a plausible route to the same overwrite through the UI.

1. On a **fresh profile** for a **returning** account (one that already has
   server progress), study a few cards signed out **in SRS Review mode**.
2. Sign in with the network throttled hard (DevTools → Network → Slow 3G) so
   `/account/syncing` hits its 5s timeout.

**Expect:** the timeout treats the account as having no server data, so the
import offer may appear when it should not. Clicking **Import** now only merges
this browser's few cards into the account rather than replacing it, so the
history survives — but the *prompt itself* is still wrong.

**Record whether the offer appears.** If it does, the remaining fix is to
distinguish "server has no data" from "we could not reach the server" — a UI
correctness issue now rather than a data-loss one.

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
  --command "SELECT language, COUNT(*) AS cards, MAX(last_reviewed) AS newest FROM srs_cards GROUP BY language"
```

Hebrew activity must never change the greek count.

**Result — 2026-08-08, first run against production (PASS)**

| language | cards | newest review |
|---|---|---|
| greek | 76 | 2026-06-17 |
| hebrew | 21 | 2026-08-08 |

No greek card touched despite a full day of Hebrew sync activity. Three
independent sources agree: server `MAX(last_reviewed)` on greek rows, the
`lastStudyDate` in greek's browser localStorage, and greek's own counters (76
cards against 175 total reviews ≈ 2.3 reviews per card — a coherent history, not
an inflated one). Language scoping confirmed working in production, not just
against SQLite in the test runner.

Re-run this after test 10; that is the point of maximum write pressure.

---

### 16. Reset SRS reaches the server

**Why:** since `PUT` merges, clearing localStorage alone would be undone by the
next sync. Reset has to call `DELETE`.

1. On **A**, signed in with synced progress, click **Reset SRS** and confirm.
2. Check `/api/progress`.

**Expect:** `{"data":null}` — the account's Hebrew progress is gone, not just
this browser's.

3. On **B** (still holding the old cards), click **Sync now**.

**Expect:** B's local progress uploads and the account is repopulated from B.
That is correct behaviour for a per-device reset, not a bug — but know that it
happens, because it surprises people.

---

## Why the fix lives on the server

The session-end push is a one-shot keepalive request. It cannot pull, merge, and
put during unload — the page may be gone before the first response arrives. So
the client cannot be made to sync safely at that moment.

Three options were on the table:

1. **Merge server-side on `PUT`.** ← chosen
2. Pull on every page load, not just sign-in. Costs a request per session and
   still leaves a window between load and the first study action.
3. Make the session-end push a merge. Not reliably possible, per above.

(1) is the only one that holds even when a client misbehaves — an old cached
build, a second tab with stale state, or a hand-crafted request. The others only
protect clients that cooperate.

The cost is that `PUT` can no longer remove anything, which is why deletion
moved to `DELETE` (test 16).

**Still open:** the timeout-vs-empty ambiguity in test 11. It is now a wrong
prompt rather than data loss, so it is worth fixing but not urgent.

## Reporting

For anything surprising, capture:

- which device, and what the other device's state was at the time
- the side-by-side `console.table` output from both devices
- the raw `/api/progress` response
- which of the three sync triggers fired

The trigger is the part that is easiest to lose track of and most often explains
the result.
