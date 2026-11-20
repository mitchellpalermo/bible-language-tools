"""Apply exact replacements to a page's working wikitext.

    python3 tools/proof_fix.py 230 'text=נִפְלְאה}}' 'text=נִפְלֵאת}}' 'the and ' 'the 2nd '

Arguments after the page come in old/new pairs. Each `old` must occur exactly
once in the page (include enough context to make it unique), or nothing is
written — a fix that lands on the wrong occurrence is worse than none.
Every applied fix is appended to proof/corrections.tsv, which is the record of
how this edition departs from Wikisource.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def esc(s: str) -> str:
    """Keep one fix on one TSV row: a fix spanning a line break is logged with \\n."""
    return s.replace("\\", "\\\\").replace("\n", "\\n").replace("\t", "\\t")


def main() -> None:
    page, pairs = sys.argv[1], sys.argv[2:]
    if not pairs or len(pairs) % 2:
        sys.exit(__doc__)
    path = ROOT / "proof" / "pages" / f"{page}.wiki"
    text = path.read_text()
    log = []
    for old, new in zip(pairs[::2], pairs[1::2]):
        if old == new:
            sys.exit(f"'{old}' is replaced by itself — nothing written; a no-op would pollute corrections.tsv")
        n = text.count(old)
        if n != 1:
            sys.exit(f"'{old}' occurs {n} times in page {page} — nothing written; add context")
        text = text.replace(old, new)
        log.append(f"{page}\t{esc(old)}\t{esc(new)}\n")
    path.write_text(text)
    with (ROOT / "proof" / "corrections.tsv").open("a") as f:
        f.writelines(log)
    print(f"{len(log)} fixes applied to page {page}")


if __name__ == "__main__":
    main()
