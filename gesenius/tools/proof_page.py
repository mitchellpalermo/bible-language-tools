"""Prepare one page for proofreading against the scan.

    python3 tools/proof_page.py 230

Writes the scan strips to proof/strips/<page>-<k>.png (read them as images),
prints the page's working wikitext with line numbers, and prints an English
word diff against the scan's own OCR text layer.

The OCR layer is useless for Hebrew but good for English, and it is an
independent reading: where it has words the wikitext lacks, the wikitext has
usually dropped them. That is exactly how the unproofread pages fail — an
English gloss after a Hebrew word goes missing ("מָלֵא to be full" -> "מָלֵא"),
or "2nd" is read as "and". The diff is a pointer, not an authority: the scan
image decides.
"""
import difflib
import functools
import pathlib
import unicodedata
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCAN = ROOT / "scan" / "geseniushebrewgr00geseuoft.pdf"
STRIPS = ROOT / "proof" / "strips"
PAGES = ROOT / "proof" / "pages"

N_STRIPS = 4
OVERLAP = 40  # px at 300 dpi, so a line cut by a strip edge appears whole in one strip
ZOOM = "140%"


def render_strips(n: int) -> list[pathlib.Path]:
    STRIPS.mkdir(parents=True, exist_ok=True)
    for old in STRIPS.glob(f"{n}-*.png"):
        old.unlink()
    base = STRIPS / f"_{n}"
    subprocess.run(["pdftoppm", "-f", str(n), "-l", str(n), "-r", "300", "-png", "-singlefile",
                    str(SCAN), str(base)], check=True)
    full = base.with_suffix(".png")
    w, h = map(int, subprocess.run(["magick", "identify", "-format", "%w %h", str(full)],
                                   capture_output=True, text=True, check=True).stdout.split())
    step = h // N_STRIPS
    out = []
    for k in range(N_STRIPS):
        y = max(0, k * step - OVERLAP)
        hh = min(h - y, step + 2 * OVERLAP)
        dst = STRIPS / f"{n}-{k + 1}.png"
        subprocess.run(["magick", str(full), "-crop", f"{w}x{hh}+0+{y}", "+repage",
                        "-resize", ZOOM, str(dst)], check=True)
        out.append(dst)
    full.unlink()
    return out


def english_words_from_wiki(text: str) -> list[str]:
    t = re.sub(r"<noinclude>.*?</noinclude>", " ", text, flags=re.S)
    t = re.sub(r"<!--.*?-->", " ", t, flags=re.S)
    # keep a template's English (glosses, terms), drop its Hebrew
    t = re.sub(r"\btext\s*=", " ", t)
    t = re.sub(r"\{\{GHGbible-ref\|book=([^|}]*)\|chapter=([^|}]*)(?:\|verse=([^|}]*))?[^}]*\}\}",
               lambda m: f" {m.group(1)} {m.group(2)} {m.group(3) or ''} ", t)
    t = re.sub(r"\{\{GHGpar\|([^|}]*)\|?([^|}]*)[^}]*\}\}", r" § \1 \2 ", t)
    t = re.sub(r"\{\{GHGmargin-letter\|[^}]*\}\}", " ", t)
    t = re.sub(r"\{\{\s*(center|Small-caps|smaller|larger|nowrap|fs|asc|lang|polytonic|abbr)\s*\|", " ", t, flags=re.I)
    t = re.sub(r"[{}|\[\]']|<[^>]+>|\b(GHG[\w-]*|translate|pron|en|book|chapter|verse|hidebook|title|sup)\b", " ", t)
    return words(t)


def words(t: str) -> list[str]:
    t = re.sub(r"[\u0590-\u05FF\uFB1D-\uFB4F]+", " ", t)
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    # digits are left to the eye: OCR mangles superscript verse numbers
    return [w.lower() for w in re.findall(r"[A-Za-z]+", t) if len(w) > 1]


@functools.lru_cache(maxsize=1)
def dictionary() -> frozenset:
    ws = {w.strip().lower() for w in open("/usr/share/dict/words")}
    ws |= {"masc", "fem", "sing", "plur", "imperf", "perf", "infin", "imper", "constr", "suff",
           "nd", "rd", "st", "th", "cf", "lxx", "mss", "ibid", "viz", "etc", "pause"}
    return frozenset(ws)


def is_real(seq: list[str]) -> bool:
    d = dictionary()
    return any(len(w) >= 2 and w in d for w in seq)


def ocr_words(n: int) -> list[str]:
    txt = subprocess.run(["pdftotext", "-f", str(n), "-l", str(n), str(SCAN), "-"],
                         capture_output=True, text=True).stdout
    lines = txt.splitlines()[1:]  # drop the running head
    return words(" ".join(lines))


def _report(a, b, base_ctx=None) -> list[str]:
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    out = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        ws_, oc = " ".join(a[i1:i2]), " ".join(b[j1:j2])
        # OCR noise from Hebrew is consonant soup; report only real English words
        if not is_real(a[i1:i2]) and not is_real(b[j1:j2]):
            continue
        if op == "replace" and min(len(ws_), len(oc)) >= 4 and difflib.SequenceMatcher(None, ws_, oc).ratio() > 0.75:
            continue  # OCR misspelling of the same word (fem/fern, when/wlien)
        ctx = " ".join(a[max(0, i1 - 4):i1])
        out.append((op, i1, i2, j1, j2, f"  …{ctx} | wiki: [{ws_}]  ocr: [{oc}]"))
    return out


def english_diff(n: int, wiki: str) -> list[str]:
    a, b = english_words_from_wiki(wiki), ocr_words(n)
    ops = _report(a, b)
    # footnotes sit inline in the wikitext and at the foot in the OCR: pair a
    # wiki-only block with an OCR-only block of the same words, and diff those
    big_a = [o for o in ops if o[2] - o[1] >= 8]
    big_b = [o for o in ops if o[4] - o[3] >= 8]
    lines, paired = [], set()
    for oa in big_a:
        for ob in big_b:
            if id(ob) in paired:
                continue
            if difflib.SequenceMatcher(None, a[oa[1]:oa[2]], b[ob[3]:ob[4]], autojunk=False).ratio() > 0.6:
                paired |= {id(oa), id(ob)}
                lines += ["  (moved block, e.g. a footnote:)"] + [x[5] for x in _report(a[oa[1]:oa[2]], b[ob[3]:ob[4]])]
                break
    return [o[5] for o in ops if id(o) not in paired] + lines


def main() -> None:
    n = int(sys.argv[1])
    src = PAGES / f"{n}.wiki"
    wiki = src.read_text()
    strips = render_strips(n)
    print(f"== page {n} (printed {n - 24}) — edit {src}")
    print("strips:", " ".join(str(s) for s in strips))
    print("── English differences vs scan OCR (pointers only; check the image) ──")
    for line in english_diff(n, wiki)[:60]:
        print(line)
    from proof_hebrew import sheet, wiki_hebrew
    print("hebrew sheet (crops numbered in reading order):", " ".join(str(p) for p in sheet(n)))
    print("── Hebrew in the wikitext, in order (compare with the sheet) ──")
    print(" | ".join(f"{i}:{h}" for i, h in enumerate(wiki_hebrew(wiki), 1)))
    print("── wikitext ──")
    for i, line in enumerate(wiki.splitlines(), 1):
        print(f"{i:3}│ {line}")


if __name__ == "__main__":
    main()
