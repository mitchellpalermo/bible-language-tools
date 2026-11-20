"""Build the whole book (Protocol D, chunk S1).

    .venv/bin/python -I tools/build_book.py            # writes build/book.typ
    (cd build && typst compile --font-path ../fonts book.typ book.pdf)

Text comes from proof/pages/<scan>.wiki where the proofreading queue made a
working copy, else from Wikisource (ws/pages.json). Nothing here edits the
proofread text: corrections go into proof/pages via tools/proof_fix.py and a
rebuild picks them up.
"""
from __future__ import annotations

import json
import pathlib
import re
import struct
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from convert import PAGE_CLOSE, PAGE_OPEN, Converter, assemble, to_typst  # noqa: E402
from book_back import indexes_part, paradigms_part  # noqa: E402
from frontmatter import PRINT_PLACEHOLDERS, contents, edition_note, title_page, verso, write_qr  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
BODY = range(25, 531)  # scan pages of §1 – §167; 531 opens the paradigms

# ── Parts, chapters and sub-heads ────────────────────────────────────────────
# The 1910 printing sets these as free-form centred blocks. Each entry names the
# § the block sits in, a pattern its text must match, and the headings that
# replace it (level 1 Part, 2 Chapter, 3 sub-head). Every entry must be used
# exactly once, or the build stops.
STRUCTURE = [
    (1, r"^HEBREW GRAMMAR$", []),  # the 1910 half-title over §1; the book's own title page replaces it
    (1, r"^INTRODUCTION$", [(1, "Introduction")]),
    (5, r"^FIRST PART", [(1, "First Part: Elementary Principles, or the Sounds and Characters"),
                         (2, "Chapter I. The Individual Sounds and Characters")]),
    (18, r"^CHAPTER II PECULIARITIES", [(2, "Chapter II. Peculiarities and Changes of Letters: the Syllable and the Tone")]),
    (30, r"^SECOND PART", [(1, "Second Part: Etymology, or the Parts of Speech")]),
    (32, r"^CHAPTER I THE PRONOUN", [(2, "Chapter I. The Pronoun")]),
    (38, r"^CHAPTER II THE VERB", [(2, "Chapter II. The Verb")]),
    (42, r"^I\. The Strong Verb", [(3, "I. The Strong Verb")]),
    (43, r"^A\. The Pure Stem", [(3, "A. The Pure Stem, or Qal")]),
    (51, r"^Verba Derivativa", [(3, "Verba Derivativa, or Derived Conjugations")]),
    (57, r"^C\. Strong Verb", [(3, "C. Strong Verb with Pronominal Suffixes")]),
    (66, r"^II\. The Weak Verb", [(3, "II. The Weak Verb")]),
    (79, r"^CHAPTER III THE NOUN", [(2, "Chapter III. The Noun")]),
    (99, r"^CHAPTER IV THE PARTICLES", [(2, "Chapter IV. The Particles")]),
    (106, r"^THIRD PART", [(1, "Third Part: Syntax"), (2, "Chapter I. The Parts of Speech"),
                           (3, "I. Syntax of the Verb"), (3, "A. Use of the Tenses and Moods")]),
    (113, r"^B\. THE INFINITIVE", [(3, "B. The Infinitive and Participle")]),
    (117, r"^C\. THE GOVERNMENT", [(3, "C. The Government of the Verb")]),
    (122, r"^II\. Syntax of the Noun", [(3, "II. Syntax of the Noun")]),
    (135, r"^III\. Syntax of the Pronoun", [(3, "III. Syntax of the Pronoun")]),
    (140, r"^CHAPTER II THE SENTENCE", [(2, "Chapter II. The Sentence"), (3, "I. The Sentence in General")]),
    (148, r"^II\. Special Kinds", [(3, "II. Special Kinds of Sentences")]),
]
# where, inside a block, each heading's own words end (a footnote after them belongs to that heading)
HEAD_WORDS = {"Third Part: Syntax": "SYNTAX", "A. Use of the Tenses and Moods": "Moods."}


def load_pages() -> dict:
    pages = json.loads((ROOT / "ws" / "pages.json").read_text())
    for p in (ROOT / "proof" / "pages").glob("*.wiki"):
        pages[p.stem] = {"text": p.read_text()}
    return pages


def centred_blocks(text: str):
    """(start, end, inner) for every {{center|…}} and centred <div> in the text."""
    for m in re.finditer(r'<div style="text-align: ?center[^"]*">', text):
        e = text.find("</div>", m.end())
        yield m.start(), e + len("</div>"), text[m.end():e]
    for m in re.finditer(r"\{\{center\|", text):
        i, depth = m.end(), 1
        while depth:
            if text.startswith("{{", i):
                depth += 1; i += 2
            elif text.startswith("}}", i):
                depth -= 1; i += 2
            else:
                i += 1
        yield m.start(), i, text[m.end():i - 2]


def plain(s: str) -> str:
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"\{\{(?:larger|Small-caps)\|(.*?)\}\}", r"\1", s, flags=re.S)
    s = re.sub(r"<[^>]+>|'''|''", "", s)
    return re.sub(r"\s+", " ", s).strip()


def apply_structure(text: str, conv: Converter) -> str:
    edits, used = [], set()
    for start, end, inner in centred_blocks(text):
        secs = re.findall(r'<section begin="?par(\d+)', text[:start])
        sec = int(secs[-1]) if secs else 0
        for i, (want, pat, heads) in enumerate(STRUCTURE):
            if sec != want or not re.search(pat, plain(inner), re.I):
                continue
            if i in used:
                raise SystemExit(f"structure entry for §{want} matched twice")
            used.add(i)
            refs = [(m.start(), m.group(0)) for m in re.finditer(r"<ref[^>]*>.*?</ref>", inner, re.S)]
            out = []
            for title_i, (level, title) in enumerate(heads):
                # a footnote belongs to the heading whose words it follows; any
                # left over by the last heading belongs to it
                words = HEAD_WORDS.get(title)
                last = title_i == len(heads) - 1
                mine = [r for r in refs if words and r[0] >= inner.find(words)][:1] if not last else list(refs)
                if len(mine) > 1:
                    raise SystemExit(f"§{want}: two footnotes on the heading {title!r}")
                note = ""
                if mine:
                    key = f"bookhead-{want}-{title_i}"
                    conv.footnotes[key] = re.sub(r"^<ref[^>]*>|</ref>$", "", mine[0][1])
                    refs.remove(mine[0])
                    note = f"|note={key}"
                out.append(f"\n\n{{{{GHGbookhead|{level}|{title}{note}}}}}\n\n")
            edits.append((start, end, "".join(out)))
    missing = [STRUCTURE[i][0] for i in range(len(STRUCTURE)) if i not in used]
    if missing:
        raise SystemExit(f"structure entries not found for §§ {missing}")
    for start, end, rep in sorted(edits, reverse=True):
        # a 1910 page marker just before a heading block goes after the new
        # headings, so it is not stranded on the page before a Part opener
        m = re.search(f"{PAGE_OPEN}[^{PAGE_CLOSE}]*{PAGE_CLOSE}\\s*$", text[:start])
        if m and rep:
            rep, start = rep + m.group(0).strip(), m.start()
        text = text[:start] + rep + text[end:]
    return text


BAB_SIGN = re.compile(r"(?<!\{)\{Babylonian ((?:[^{}]|\{\{[^{}]*\}\})*?) mark\}")


def babylonian_signs(text: str) -> str:
    """The Babylonian (superlinear) vowel signs of §8 g note 3 have no Unicode characters.
    The wikitext names each as {Babylonian … mark}; in order of appearance they are the
    images build/bab/01.png … 20.png, cropped from scan page 67."""
    n = 0
    def rep(m):
        nonlocal n
        n += 1
        # set at its 1910 size: the crops come from the scan's 400 dpi image
        png = ROOT / "build" / "bab" / f"{n:02d}.png"
        w, h = struct.unpack(">II", png.read_bytes()[16:24])
        return f"{{{{GHGbabsign|bab/{n:02d}.png|{w / 400:.4f}in}}}}"
    text = BAB_SIGN.sub(rep, text)
    have = len(list((ROOT / "build" / "bab").glob("*.png")))
    if n != have:
        raise SystemExit(f"{n} Babylonian signs in the text but {have} images in build/bab")
    return text


def body(pages: dict, conv: Converter) -> str:
    text = assemble(pages, list(BODY))
    text = babylonian_signs(text)
    text = apply_structure(text, conv)
    typ = to_typst(text, conv)
    # any 1910 page marker left just before a heading goes after it
    return re.sub(r"(#origpage\([^)]*\);)\s*((?:#bookhead\(.*?\);\s*)+)", r"\2\1\n\n", typ)


# ── Front matter ─────────────────────────────────────────────────────────────
def section_text(pages: dict, djvus: list[int], sec: str) -> str:
    """The wikitext of one front-matter section, without its centred 1910 title."""
    text = assemble(pages, djvus)
    text = re.sub(r"<section (?:begin|end)=[^>]*/>", "", text)
    return re.sub(r'<div style="text-align: center">[A-Z’\' ]+</div>', "", text, count=1)


def front_section(pages, conv, djvus, sec, title) -> str:
    return f"#pagebreak(weak: true)\n#bookhead(2, [{title}]);\n" + to_typst(section_text(pages, djvus, sec), conv)


SBL_NOTE = ("#edition-aside[In this edition Scripture references follow the abbreviations of the _SBL Handbook of Style_ "
            "(Gen, Exod, 1 Sam, Ps …) in place of the 1910 forms (Gn, Ex, 1 S, ψ …), and chapter and verse are "
            "written 15:6 rather than 15⁶.]\n")


def siloam(pages, conv) -> str:
    text = section_text(pages, [22, 23], "siloam_inscription")
    text = text.replace("(image of the Siloam inscription in ancient script)",
                        "{{GHGimage|siloam-facsimile.png|100%}}")
    text = re.sub(r"\{\{raw image\|[^}]*\}\}", "{{GHGimage|siloam-photo.jpg|100%}}", text)
    return "#pagebreak(weak: true)\n#bookhead(2, [The Siloam Inscription]);\n" + to_typst(text, conv)


def sources_note() -> str:
    rows = [l.split("\t") for l in (ROOT / "proof" / "status.tsv").read_text().splitlines()[1:]]
    checked = sum(1 for r in rows if r[2] == "body" and r[4] in ("done", "flagged"))
    fixes = len((ROOT / "proof" / "corrections.tsv").read_text().splitlines())
    return (f"The running text comes from the volunteer transcription of this edition on English Wikisource. "
            f"The {checked} pages of it that Wikisource had not yet proofread were checked here against the scan, "
            f"and {fixes:,} corrections were made. The paradigms and the three indexes were transcribed afresh from "
            f"the scan, because Wikisource's paradigm pages are unproofread and its indexes incomplete. The 1910 list "
            f"of _Additions and Corrections_ is not reprinted, since Wikisource had already worked those corrections "
            f"into the text. Notes added by Wikisource's editors are left out. The scanned copy lacks Lidzbarski's "
            f"_Table of Early Semitic Alphabets_ (a separate plate), so this edition does not reproduce it.")


def front(pages, conv) -> str:
    out = ["#set page(numbering: \"i\")", title_page(), verso(),
           edition_note("scan-qr.svg", sources=sources_note()), contents()]
    out.append(front_section(pages, conv, [7, 8], "translators_preface", "Translator’s Preface"))
    out.append(front_section(pages, conv, [9, 10, 11], "from_the_german_preface", "From the German Preface"))
    out.append(front_section(pages, conv, [14], "list_of_abbreviations", "List of Abbreviations") + SBL_NOTE)
    out.append(siloam(pages, conv))
    # the Introduction starts page 1 on a right-hand page
    out.append("#pagebreak(to: \"odd\")\n#set page(numbering: \"1\")\n#counter(page).update(1)\n")
    return "\n".join(out)


if __name__ == "__main__":
    pages = load_pages()
    conv = Converter(additions=json.loads((ROOT / "ws" / "additions.json").read_text()))
    write_qr(str(ROOT / "build" / "scan-qr.svg"))
    doc = ['#import "gesenius.typ": *', "#show: book", front(pages, conv), body(pages, conv),
           paradigms_part(pages, conv), indexes_part(pages, conv)]
    out = "\n".join(doc)
    # the print edition's copyright-page details (ISBN, licence, …) live in
    # tools/print_details.json; until they are filled in the placeholders print as is
    details_path = ROOT / "tools" / "print_details.json"
    details = json.loads(details_path.read_text()) if details_path.exists() else {}
    missing = []
    for ph in PRINT_PLACEHOLDERS:
        value = details.get(ph.strip("[]").lower(), "")
        if value:
            out = out.replace(ph, esc(value))
        else:
            missing.append(ph)
    (ROOT / "build" / "book.typ").write_text(out)
    if missing:
        print("PRINT EDITION NOT READY: fill in", ", ".join(missing), "in tools/print_details.json")
    for w in conv.warnings:
        print("WARN", w)
    print("wrote build/book.typ")
