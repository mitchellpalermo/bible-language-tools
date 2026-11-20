---
name: gesenius-proofread
description: Proofread the next chunk of Gesenius' Hebrew Grammar against the 1910 scan for Mitch's modernized edition — body pages, verb paradigms, or index pages, one chunk per run, resuming from the queue on disk. Use this whenever Mitch says "next chunk", "keep proofreading", "continue Gesenius", "/gesenius-proofread", or runs it under /loop. It is built for /loop: it takes a lock so runs never overlap, does one chunk, and stops the loop when only the final build is left.
---

# Gesenius proofreading — one chunk per run

This skill is the repeatable unit of a long project: making a modernized PDF of
*Gesenius' Hebrew Grammar* (Kautzsch–Cowley, 1910). Everything about the
project — Mitch's decisions, the tools, the four protocols — lives in
`gesenius/HANDOFF.md` in this worktree, and the queue lives in
`gesenius/proof/status.tsv`. This file only says how a single run behaves, so
that it can be repeated by `/loop` without supervision. When the two disagree,
HANDOFF.md wins: it is the document every session has read.

Work from the `gesenius/` folder of the worktree
`.claude/worktrees/gesenius-grammar-modernize-ac64c1` (all paths below are
relative to it). Each run ends with a commit (step 4) that is also pushed to the private
`backup` remote; never push to `origin`.

## 1. Start: lock and orient

```bash
python3 tools/proof_lock.py acquire "<a short name for this run>"
```

This also starts the run timer. Take it before anything else — reading
HANDOFF.md is part of the run's real cost, and the estimate should include it.

If it refuses, another run is active. Stop now and say so in one line — two
runs on one queue would proofread the same pages and corrupt `status.tsv`.
Leave the loop running: the other run will finish, and the next firing (or,
in a self-paced loop, a wakeup you schedule ~20 minutes out) picks up after it.

Then read `HANDOFF.md` in full — every run, even under a loop, because it is
short, it is the authority, and a previous session may have added to its Log.
Then:

```bash
python3 tools/proof_status.py next
```

- **A `B` chunk** (body pages) → Protocol A in HANDOFF.md.
- **A `P` chunk** (paradigms) → Protocol B.
- **An `I` chunk** (indexes) → Protocol C.
- **"all chunks done"** → the queue is finished and only the build (Protocol D,
  chunk S1) remains. Do **not** start the build from a loop: it is design work
  Mitch will want to watch. Release the lock, tell Mitch the proofreading is
  complete and the build is next, and end the loop if you are in one: for a
  fixed-interval loop (`/loop 30m …`, the recommended form) find its job with
  `CronList` and remove it with `CronDelete`; for a self-paced loop, call
  `ScheduleWakeup` with `stop: true`.

## 2. Resume safely

A previous run may have died mid-page (usage runs out without warning). Before
the first page, look for that page's fixes in `proof/corrections.tsv`:

```bash
awk -F'\t' '$1 == <page>' proof/corrections.tsv
```

If some are there, the page is half done: those fixes are already in
`proof/pages/<page>.wiki`. Proofread the page from the start anyway — the
earlier run's reading of the rest of it is gone — and `proof_fix.py` will refuse
any fix whose old text no longer exists, so nothing is applied twice.

## 3. Work the chunk

Follow the protocol for the chunk type, page by page, exactly as HANDOFF.md
describes it. The points that keep a long unattended run honest:

- **A page is `done` only after you have compared all of it** — every strip,
  every Hebrew sheet. If you could not resolve something, `flag` the page with
  what and where, rather than marking it done or guessing.
- **Log every close call for review.** When you choose a reading the scan
  does not settle — a faint point, two plausible letters, a reference the print
  only half confirms, or a deliberate decision to leave Wikisource's text
  alone — record it before marking the page done:
  `python3 tools/proof_review.py add <page> "<what was uncertain>" "<what you chose>"`.
  Mitch checks `proof/review.tsv` against the scan later; a call that exists
  only in the chat summary is lost. Use `flag` instead only when you cannot
  choose at all.
- **The scan decides, not grammar** — except where the type itself is
  broken (a split word, a dropped point): then use the intended word and
  log it for review. See HANDOFF.md, Protocol A.
- **Expectation is not evidence.** Expectation is how a wrong "correction"
  gets in; when the print is legible, it wins.
- **Mark each page as it finishes**, not at the end of the chunk, so a run cut
  short loses at most one page.
- **One chunk per run.** Finishing a chunk is the natural checkpoint: the loop
  can start the next one with a clean slate, and a reviewer can look at a
  chunk's corrections as a unit.

## 4. Finish: unlock, log, hand on

1. `python3 tools/proof_lock.py release` — this stops the run timer and writes
   the run's row to `proof/runs.tsv` (start, end, minutes, pages, fixes,
   min/page), measured by the machine rather than recalled. It prints a
   one-line summary; keep it.
2. Append one line to the **Log** section of `HANDOFF.md`: the summary line
   from step 1, then anything the next run needs (a recurring error pattern in
   this part of the book is worth noting — the next chunk probably has it too).
3. Commit the run (and back it up):
   `python3 tools/proof_commit.py "<chunk>: <pages> pages, <fixes> fixes, <flagged> flagged, <minutes> min"`
   (numbers from the step 1 summary). The script commits `gesenius/` and this
   skill on the project's own branch whatever folder you are running in —
   which matters, because a loop session usually has a worktree of its own
   where a bare `git commit` would land on the wrong branch. It then pushes
   the branch to the private `backup` remote
   (github.com/mitchellpalermo/Genesius-grammar), so the work survives the
   Mac. Never push to `origin` — that is the public bible-language-tools repo,
   and Mitch does not want this public yet. Never open a pull request. If the
   script reports the push failed, say so in the report; the commit is still
   a local restore point and the next run's push carries it.
4. Report to Mitch in two or three lines: chunk, time taken, fixes, any
   flagged pages and why, how many review items the run added, and the last line of
   `python3 tools/proof_status.py estimate` for the hours left.
5. In a self-paced loop with work remaining, schedule the next run ~60 seconds
   out — nothing external is being waited on. A fixed-interval loop needs
   nothing: its next firing comes on its own.
