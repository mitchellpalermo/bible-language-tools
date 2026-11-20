"""A run lock, so two sessions never work the queue at once — and the run timer.

    python3 tools/proof_lock.py acquire "<who>"   # exit 1 if a live lock exists
    python3 tools/proof_lock.py release           # prints the run's timed summary
    python3 tools/proof_lock.py abandon           # clear a lock left by a run that was stopped
    python3 tools/proof_lock.py status

Two sessions on the same queue would claim the same pages and race on
status.tsv. A lock older than STALE_HOURS is treated as abandoned — a session
that ran out of usage mid-chunk cannot release it, and the next run should not
wait for it forever.

The lock also times the run, so estimates come from the machine and not from
anyone's memory: acquire records the clock, the pages already finished, and
the number of logged fixes; release appends one row to proof/runs.tsv with the
elapsed minutes and exactly which pages this run finished. A run whose lock is
taken over as stale is recorded as `abandoned` with no end time, and the
estimate ignores it — its true duration is unknown.
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from proof_status import RUNS, finished_pages, load  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCK = ROOT / "proof" / "run.lock"
CORRECTIONS = ROOT / "proof" / "corrections.tsv"
STALE_HOURS = 2  # above the longest chunk (~90 min), below a usage-limit reset
RUN_FIELDS = ["start", "end", "minutes", "who", "outcome", "chunks", "pages", "n_pages",
              "flagged", "fixes", "min_per_page"]


def now() -> dt.datetime:
    return dt.datetime.now().replace(microsecond=0)


def fix_count() -> int:
    return sum(1 for _ in CORRECTIONS.open()) if CORRECTIONS.exists() else 0


def read() -> dict | None:
    return json.loads(LOCK.read_text()) if LOCK.exists() else None


def record(lock: dict, end: dt.datetime | None, outcome: str) -> dict:
    before = set(lock["finished"])
    rows = {r["page"]: r for r in load()}
    new = [p for p in finished_pages() if p not in before]
    start = dt.datetime.fromisoformat(lock["since"])
    minutes = (end - start).total_seconds() / 60 if end else None
    row = {
        "start": lock["since"],
        "end": end.isoformat() if end else "",
        "minutes": f"{minutes:.1f}" if minutes is not None else "",
        "who": lock["who"],
        "outcome": outcome,
        "chunks": " ".join(sorted({rows[p]["chunk"] for p in new})),
        "pages": ",".join(new),
        "n_pages": len(new),
        "flagged": sum(rows[p]["status"] == "flagged" for p in new),
        "fixes": fix_count() - lock["fixes"],
        "min_per_page": f"{minutes / len(new):.1f}" if minutes is not None and new else "",
    }
    first = not RUNS.exists()
    with RUNS.open("a", newline="") as f:
        w = csv.DictWriter(f, RUN_FIELDS, delimiter="\t")
        if first:
            w.writeheader()
        w.writerow(row)
    return row


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    lock = read()
    if cmd == "acquire":
        if lock:
            age = now() - dt.datetime.fromisoformat(lock["since"])
            if age < dt.timedelta(hours=STALE_HOURS):
                sys.exit(f"locked by {lock['who']} since {lock['since']} ({age} ago) — another run is active")
            record(lock, None, "abandoned")
            print(f"took over a stale lock from {lock['who']} ({age} old); recorded it as abandoned")
        LOCK.write_text(json.dumps({"who": sys.argv[2] if len(sys.argv) > 2 else "unknown",
                                    "since": now().isoformat(), "finished": finished_pages(),
                                    "fixes": fix_count()}))
        print("lock acquired; run timer started")
    elif cmd == "release":
        if not lock:
            sys.exit("no lock to release")
        row = record(lock, now(), "released")
        LOCK.unlink()
        print(f"lock released. Run: {row['start']} → {row['end']}, {row['minutes']} min, "
              f"chunks {row['chunks'] or '—'}, {row['n_pages']} pages ({row['flagged']} flagged), "
              f"{row['fixes']} fixes, {row['min_per_page'] or '—'} min/page")
    elif cmd == "abandon":
        # a run stopped by hand or by a usage limit: free the queue, and keep its
        # partial time out of the estimate, since it is not a whole run
        if not lock:
            sys.exit("no lock to abandon")
        row = record(lock, None, "abandoned")
        LOCK.unlink()
        print(f"lock cleared; recorded {lock['who']}'s run as abandoned "
              f"({row['n_pages']} pages finished: {row['pages'] or '—'})")
    else:
        print(json.dumps({k: v for k, v in lock.items() if k != "finished"}) if lock else "unlocked")


if __name__ == "__main__":
    main()
