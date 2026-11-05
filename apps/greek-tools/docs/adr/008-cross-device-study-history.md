# ADR 008: Study history follows a signed-in student across devices

## Status

Accepted. Governs both apps; hebrew.tools first (#196), greek.tools follows (#200).

## Date

2026-11-02

---

## Context

[ADR 003](003-accounts-and-cross-device-sync.md) made the SRS store and study stats sync for signed-in students. The study-rhythm work tracked in #196 added two new kinds of progress, and both were deliberately left in the browser until a decision was made:

- **The attempt log** (`@tools/shared/attempt-log`, `hebrew-tools-attempts-v1`): every checked answer, by concept. The mastery levels, strengths map and confidence tracking in #187 are computed from it, and so are the weekly plan (#193), placement (#194) and exam mode (#189) further down the sequence.
- **Paradigm-ladder progress** (`@tools/shared/ladder`, `hebrew-tools-suffix-ladder-v1`): which rungs are open and how many clean writes each has.

#196 listed the question as "Sign-in required, or anonymous with local storage? Gates cross-device history in #187." Left local, a student who studies on an iPad and a laptop would get two partial mastery maps, each built from half their answers, and the levels would be wrong on both.

The Today study streak (#184, PR #217) already syncs. It was the first piece of #196 to reach the account, and migration `0003_today_study_streak.sql` applied cleanly in production on Nov 3, 2026.

---

## Decision

**Cross-device history is wanted, and sign-in is not required.** A student who never signs in can use every feature, with their history kept in that browser. Signing in is what makes history follow them: the attempt log and ladder progress sync to the account, on the same local-first model as ADR 003:

- `localStorage` stays the working copy. Studying never waits on the network, and a sync failure never interrupts it.
- The server is a sync target and a backup. A pull on sign-in merges the account copy into the browser; a push at session end writes it back.
- Merges are symmetric and favour more progress. The attempt log is append-only, so it merges as a union of attempts. Ladder rungs never close again, so clean-write counts and unlocks merge by max and union.
- Data is scoped by `language`, like every other synced table, so a student's Greek and Hebrew history stay apart.

Everything built later in #196 that reads history (#187, #189, #193, #194) can assume it is the student's whole history when they are signed in, and this browser's history when they are not.

Features later in #196 must work for a signed-out student too, from their local history. None may sit behind sign-in.

### How each one travels

Decided in PR #219, which builds the sync for hebrew.tools.

- **Ladder progress rides in the progress payload.** It is a handful of numbers: `ladderProgress` in `PUT /api/progress`, one `ladder_progress` row per rung, merged by the larger count per rung.
- **The attempt log has its own append-only endpoint, `/api/attempts`, not a cap or compaction.** The device keeps the newest 5,000 attempts and the account keeps the same window. At ~130 bytes an attempt, a full log is ~600 KB: past the progress `PUT`'s 512 KB body limit, ten times the 64 KB keepalive budget, and thousands of rows to rewrite on every tab switch if it were replaced whole. A tighter cap would throw away the history #187 is built from. Compaction into per-concept summaries would lose the order and timing that #187's confidence tracking and #193's weekly plan need, and every summary would have to be merged anyway. So:
  - Every attempt carries a random id. The merge is a union by id (`mergeAttempts` in `@tools/shared/sync-merge`), and the server's `INSERT OR IGNORE` is the same union, pruned to the newest 5,000.
  - A push sends only what was logged since a cursor. The session-end keepalive push carries at most 200 attempts (~26 KB). A pull sends exactly what the account lacks, by id, which repairs anything a push skipped. Each page load sends whatever is still owed.
  - `DELETE /api/progress` clears the log and the ladder too.

---

## Consequences

**Positive:**
- #187's levels and strengths map are built from every answer a signed-in student gave, on any device.
- Ladder unlocks earned on one device are open on the other.
- No new vendor or service: the same D1 database, API and merge pattern as ADR 003.

**Negative:**
- A database migration and more sync code, with the same care #217 took: prove existing rows are untouched, and take a D1 restore point before merging.
- **Erasing has to go through `DELETE`.** A union merge cannot express a deletion, so `DELETE /api/progress` clears the new data on the server too, or the next pull would put it back. The account page's reset erases SRS schedules only: it keeps the ladder and the attempt log in the browser, and its push after the delete puts them back on the account. "Start fresh" clears them in the browser as well. Other devices are still not reset (see "A merge cannot express a deletion" in the root `CLAUDE.md`).
- The attempt log is the largest thing synced so far: up to 5,000 attempts on each device and in the account. That is about a year of history at a few dozen answers a day. A longer history would need the window raised on both sides together.
- A second endpoint, and a push cursor on each device, to maintain beside `/api/progress`.
- Ladder clean writes made on two devices between syncs are not added together, because counting writes per device would be needed to tell them apart. A rung can take one extra clean write to open. It can never open early.

---

## Alternatives Considered

### Keep history local
No new sync code. Rejected: mastery levels from half a student's answers are wrong, and the study-rhythm features are meant for a student who opens the site daily on whatever device is at hand.

### Require sign-in
One history per student, always complete, and no local-only path to maintain. Rejected: sign-in should not be required.

### Server as the source of truth for history
Write each attempt straight to the API. Rejected for the same reason ADR 003 rejected it: it breaks offline study and puts a network call inside a drill.
