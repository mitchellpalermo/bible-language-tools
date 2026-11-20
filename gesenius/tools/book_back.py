"""The back of the book: the paradigms and the three indexes (used by build_book.py)."""
from __future__ import annotations

import pathlib
import re

from convert import assemble, esc, to_typst, tstr

ROOT = pathlib.Path(__file__).resolve().parent.parent


# ── Paradigms ────────────────────────────────────────────────────────────────
def paradigms_part(pages, conv) -> str:
    import paradigms as P
    from render_paradigm import paradigm
    intro = assemble(pages, [531])
    intro = intro.replace("{{center|'''THE PARADIGMS.'''}}", "")
    out = ["#bookhead(1, [The Paradigms]);", to_typst(intro, conv)]
    for name in sorted(n for n in dir(P) if re.fullmatch(r"PARADIGM_[A-Z]", n)):
        out.append("#pagebreak(weak: true)")
        out.append(paradigm(getattr(P, name)))
    return "\n".join(out)


# ── Indexes ──────────────────────────────────────────────────────────────────
INDEXES = [
    ("Index of Subjects", range(557, 568), 2,
     "The numbers refer to the sections, except where otherwise indicated. N. = note."),
    ("Index of Hebrew Words and Forms", range(568, 589), 3,
     "The numbers refer to the sections: the ‘superior’ figures after the letters refer to the notes. "
     "Doubtful forms are marked ? Corrupt forms with †."),
    ("Index of Passages", range(589, 623), 3,
     "The references are to the sections and their marginal letters, except where otherwise indicated. N. = note. "
     "A page number (p. 286) is a page of the 1910 printing, shown in the inner margin of this edition."),
]


def index_entries(text: str) -> list[str | None]:
    """The entries of one index page, in order; None marks a gap between letter groups."""
    text = re.sub(r"<noinclude>.*?</noinclude>|<section[^>]*/>|<!--.*?-->", "", text, flags=re.S)
    if "{{colbegin}}" in text:
        text = text.split("{{colbegin}}", 1)[1].split("{{colend}}", 1)[0]
        out: list[str | None] = []
        for line in text.split("\n"):
            if line.strip():
                out.append(line.strip())
            elif out and out[-1] is not None:
                out.append(None)
        return out
    # a Wikisource page laid out as a three-cell table; entries are separated by blank lines
    text = re.sub(r"^.*?(?=\{\|)", "", text, flags=re.S)
    lines = []
    for line in text.split("\n"):
        if line.startswith(("{|", "|}")):
            continue
        lines.append(re.sub(r'^\|\s*style="[^"]*"\s*\|', "", line))
    chunks = re.split(r"\n\s*\n", "\n".join(lines))
    return [re.sub(r"\s*\n\s*", " ", c).strip() for c in chunks if c.strip()]


PAGE_REF = re.compile(r"\bp\. (\d+)")


REF = re.compile(r"(?<![\d>§])(?<!p\. )(\d{1,3})(?:<sup>([ab])</sup>)?(?: ''([a-z]{1,2})'')?(?![\w<])"
                 r"|''([a-z]{1,2})''")


def link_refs(wt: str) -> str:
    """Make the § references in an index entry links: 141 ''c'' and a following ''d'' (same §)."""
    out, last, pos = [], None, 0
    for m in REF.finditer(wt):
        gap = wt[pos:m.start()]
        num, ab, letter, lone = m.groups()
        if num:
            last = (num, ab or "")
            rep = f"{{{{GHGpar|{num}|{letter}|{ab or ''}|nosign=1}}}}" if letter else f"{{{{GHGpar|{num}||{ab or ''}|nosign=1}}}}"
        elif last and re.fullmatch(r"\s*[,–-]\s*(?:and\s+)?", gap):
            rep = f"{{{{GHGpar|{last[0]}|{lone}|{last[1]}|nonumber=1|nosign=1}}}}"
        else:
            last, rep = None, m.group(0)
        out.append(gap + rep)
        pos = m.end()
    return "".join(out) + wt[pos:]


def entry_typst(wt: str, conv) -> str:
    if "GHGpar" not in wt:  # Wikisource's own pages already carry the links
        wt = link_refs(wt)
    t = to_typst(wt, conv).strip().replace("\n\n", " ")
    return PAGE_REF.sub(lambda m: f"p. #xref(<orig-{m.group(1)}>)[{m.group(1)}];", t)


def passage_rows(entries, conv, marker) -> list[str]:
    out = []
    for e in entries:
        if e is None:
            continue
        m = re.fullmatch(r"==\s*(.+?)\s*==", e)
        if m:
            out.append(f"#pbook[{esc(m.group(1))}];")
            continue
        verse, refs = (x.strip() for x in e.split("|", 1))
        ch = ""
        mm = re.fullmatch(r"'''(\d+)'''\s+(.+)", verse)
        if mm:
            ch, verse = mm.groups()
        out.append(f"#prow({tstr(ch)}, {tstr(verse)})[{marker}{entry_typst(refs, conv)}];")
        marker = ""
    return out


def indexes_part(pages, conv) -> str:
    out = []
    for title, scan, ncols, note in INDEXES:
        body = []
        for n in scan:
            src = ROOT / "proof" / "pages" / f"{n}.wiki"
            text = src.read_text() if src.exists() else pages[str(n)]["text"]
            entries = index_entries(text)
            marker = f"#origpage({tstr(str(n - 24))}) <orig-{n - 24}> "  # no ";" after a label: Typst prints it
            if title == "Index of Passages":
                body += passage_rows(entries, conv, marker)
                continue
            for e in entries:
                body.append("#igap();" if e is None else marker + entry_typst(e, conv))
                marker = ""
        out.append(f"#bookhead(1, [{title}]);\n#index-intro[{esc(note)}];\n"
                   f"#index-cols({ncols})[\n" + "\n\n".join(body) + "\n];")
    return "\n".join(out)
