"""Record a close judgment call for Mitch to double-check later.

    python3 tools/proof_review.py add 223 "stem קוּט/קוֹט: dot over the vav is faint" "read קוֹט (holem)"
    python3 tools/proof_review.py list          # open items only
    python3 tools/proof_review.py list --all

A judgment call is a reading the run had to choose where the scan was not
decisive: a faint or broken point, two plausible letters, a reference that
differs from Wikisource in a way the print only half settles, or a deliberate
choice to leave Wikisource's text alone. It sits between `done` (no doubt) and
`flag` (could not resolve): the page is still marked done, but the choice is
written down so a person can check it against the scan.

Each call is one row of proof/review.tsv:

    page  status  question  choice  logged

`status` starts as `open`. Mitch edits it by hand once checked: `ok` if the
choice stands, or `fix` with the correction applied separately through
proof_fix.py (which keeps corrections.tsv the single record of changed text).
"""
import datetime
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REVIEW = ROOT / "proof" / "review.tsv"
HEADER = "page\tstatus\tquestion\tchoice\tlogged\n"


def rows() -> list[list[str]]:
    if not REVIEW.exists():
        return []
    lines = REVIEW.read_text().splitlines()[1:]
    return [line.split("\t") for line in lines if line.strip()]


def add(page: str, question: str, choice: str) -> None:
    for field in (question, choice):
        if "\t" in field or "\n" in field:
            sys.exit("question and choice must be single-line, without tabs")
    if not REVIEW.exists():
        REVIEW.write_text(HEADER)
    today = datetime.date.today().isoformat()
    with REVIEW.open("a") as f:
        f.write(f"{page}\topen\t{question}\t{choice}\t{today}\n")
    print(f"logged for review: page {page}")


def show(include_closed: bool) -> None:
    items = [r for r in rows() if include_closed or r[1] == "open"]
    for page, status, question, choice, _ in items:
        print(f"{page:>4}  {status:<5} {question}  →  {choice}")
    print(f"{len(items)} item(s)")


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 4 and args[0] == "add":
        add(*args[1:])
    elif args[:1] == ["list"]:
        show("--all" in args)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
