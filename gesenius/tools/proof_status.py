"""Proofreading progress — the single source of truth is proof/status.tsv.

    python3 tools/proof_status.py init          # once: create status.tsv + working copies
    python3 tools/proof_status.py summary       # counts per chunk
    python3 tools/proof_status.py next          # the next chunk with work left, and its pages
    python3 tools/proof_status.py done 230 "gloss 'to be full' restored; and→2nd"
    python3 tools/proof_status.py flag 231 "can't read pointing on line 12, left as is"
    python3 tools/proof_status.py estimate      # hours left, from timed runs in proof/runs.tsv

A page is marked done only after its corrected wikitext is saved in
proof/pages/<n>.wiki. Never mark a page done that you did not compare.
"""
from __future__ import annotations

import csv
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATUS = ROOT / "proof" / "status.tsv"
RUNS = ROOT / "proof" / "runs.tsv"
FINISHED = ("done", "flagged", "skip")
# relative cost per page, used only for a kind no run has timed yet
GUESS_WEIGHT = {"body": 1.0, "paradigm": 3.0, "index": 2.0}
PAGES = ROOT / "proof" / "pages"
FIELDS = ["page", "printed", "kind", "chunk", "status", "notes"]

BODY_CHUNK = 12
INDEX_CHUNK = 8
# paradigm spreads, by scan page (see memory note / §§ in the HANDOFF)
PARADIGM_CHUNKS = {
    "P01": range(532, 538),  # A pronouns, B strong verb, C strong verb with suffixes
    "P02": range(538, 542),  # D I-guttural, E II-guttural, F III-guttural
    "P03": range(542, 546),  # G geminate, H I-nun, I I-aleph
    "P04": range(546, 550),  # K, L I-yod, M/N hollow
    "P05": range(550, 556),  # O III-aleph, P/Q III-he (556 is blank)
}


def load() -> list[dict]:
    with STATUS.open() as f:
        return list(csv.DictReader(f, delimiter="\t"))


def save(rows: list[dict]) -> None:
    with STATUS.open("w", newline="") as f:
        w = csv.DictWriter(f, FIELDS, delimiter="\t")
        w.writeheader()
        w.writerows(rows)


def init() -> None:
    if STATUS.exists():
        sys.exit("status.tsv already exists — refusing to overwrite progress")
    pages = json.loads((ROOT / "ws" / "pages.json").read_text())
    PAGES.mkdir(parents=True, exist_ok=True)
    rows = []
    body = sorted(int(k) for k, v in pages.items() if v["quality"] < 3 and 25 <= int(k) < 532)
    for i, n in enumerate(body):
        rows.append({"page": n, "printed": n - 24, "kind": "body",
                     "chunk": f"B{i // BODY_CHUNK + 1:02}", "status": "todo", "notes": ""})
    for chunk, rng in PARADIGM_CHUNKS.items():
        for n in rng:
            rows.append({"page": n, "printed": n - 24, "kind": "paradigm", "chunk": chunk,
                         "status": "todo", "notes": ""})
    for i, n in enumerate(range(558, 627)):
        rows.append({"page": n, "printed": n - 24, "kind": "index",
                     "chunk": f"I{i // INDEX_CHUNK + 1:02}", "status": "todo", "notes": ""})
    for r in rows:
        n = str(r["page"])
        if n in pages:
            (PAGES / f"{n}.wiki").write_text(pages[n]["text"])
    save(rows)
    print(f"{len(rows)} pages queued")


def summary() -> None:
    rows = load()
    chunks: dict[str, list[dict]] = {}
    for r in rows:
        chunks.setdefault(r["chunk"], []).append(r)
    for c, rs in chunks.items():
        done = sum(r["status"] in ("done", "flagged", "skip") for r in rs)
        print(f"{c}  {done:2}/{len(rs):2}  pages {rs[0]['page']}–{rs[-1]['page']}  ({rs[0]['kind']})")
    total = sum(r["status"] in ("done", "flagged", "skip") for r in rows)
    print(f"total {total}/{len(rows)}")


def next_chunk() -> None:
    for r in load():
        if r["status"] == "todo":
            c = r["chunk"]
            pages = [x["page"] for x in load() if x["chunk"] == c and x["status"] == "todo"]
            print(f"next chunk {c} ({r['kind']}): pages {' '.join(pages)}")
            return
    print("all chunks done")


def finished_pages() -> list[str]:
    """Pages finished by a person (skips are not work, so they are not counted)."""
    return [r["page"] for r in load() if r["status"] in ("done", "flagged")]


def estimate() -> None:
    rows = load()
    kind_of = {r["page"]: r["kind"] for r in rows}
    left: dict[str, int] = {}
    for r in rows:
        if r["status"] == "todo":
            left[r["kind"]] = left.get(r["kind"], 0) + 1
    minutes: dict[str, float] = {}
    pages: dict[str, int] = {}
    if RUNS.exists():
        with RUNS.open() as f:
            for run in csv.DictReader(f, delimiter="\t"):
                if run["outcome"] != "released" or not run["pages"]:
                    continue
                done = run["pages"].split(",")
                # split a run's time across kinds in proportion to its pages
                for kind in {kind_of.get(p, "body") for p in done}:
                    n = sum(kind_of.get(p, "body") == kind for p in done)
                    minutes[kind] = minutes.get(kind, 0) + float(run["minutes"]) * n / len(done)
                    pages[kind] = pages.get(kind, 0) + n
    if not pages:
        print("no timed runs yet — run a chunk first")
        return
    base = sum(minutes.values()) / sum(pages.values())  # min/page over everything timed
    body_rate = minutes["body"] / pages["body"] if pages.get("body") else base
    total = 0.0
    print(f"{'kind':9} {'left':>5} {'min/page':>9}  basis")
    for kind in ("body", "paradigm", "index"):
        if pages.get(kind):
            rate, basis = minutes[kind] / pages[kind], f"measured over {pages[kind]} pages"
        else:
            rate, basis = body_rate * GUESS_WEIGHT[kind], f"guess: {GUESS_WEIGHT[kind]:g}× body rate"
        n = left.get(kind, 0)
        total += n * rate
        print(f"{kind:9} {n:5} {rate:9.1f}  {basis}")
    print(f"≈ {total / 60:.1f} hours of loop time left (excludes the S1 build and usage-limit pauses)")


def mark(status: str, page: str, note: str) -> None:
    rows = load()
    for r in rows:
        if r["page"] == page:
            r["status"], r["notes"] = status, note
            save(rows)
            print(f"{page} → {status}")
            return
    sys.exit(f"page {page} is not in the queue")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "init":
        init()
    elif cmd == "summary":
        summary()
    elif cmd == "next":
        next_chunk()
    elif cmd == "estimate":
        estimate()
    elif cmd in ("done", "flag"):
        mark("done" if cmd == "done" else "flagged", sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
    else:
        sys.exit(__doc__)
