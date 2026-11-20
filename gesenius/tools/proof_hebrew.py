"""A contact sheet of every Hebrew word on a scan page, enlarged and numbered.

The scan's OCR layer cannot read Hebrew, but it still boxes it: a Hebrew word
comes out as consonant soup ("DnNT*", "nS'lfO") with a correct bounding box.
So every OCR token that is not English, not a number and not a known
abbreviation is taken to be Hebrew, padded to catch points above and below
the line, merged with Hebrew neighbours on the same line, and cropped.

Crops are in reading order (line by line, left to right), which is the order
the wikitext's Hebrew appears in; a multi-word Hebrew phrase is one crop. A few
false positives (a mangled English word) are expected and harmless.

    python3 tools/proof_hebrew.py 230      -> proof/strips/230-heb-1.png [, -2 …]
"""
import html
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from proof_page import SCAN, STRIPS, dictionary  # noqa: E402

DPI = 300
SCALE = DPI / 72
ENLARGE = 2.6
SHEET_W = 1900
SHEET_H = 1900

NOT_HEBREW = {
    "gn", "ex", "lv", "nu", "dt", "jos", "ju", "is", "jer", "ez", "ho", "jo", "am", "ob", "jon",
    "mi", "na", "hb", "zp", "hag", "zc", "mal", "ps", "pr", "jb", "ct", "ru", "la", "ec", "est",
    "dn", "ezr", "neh", "ch", "k", "s", "cf", "&c.", "e.g.", "i.e.", "viz.", "lxx", "mss",
    "niph", "pi", "hiph", "hoph", "hithp", "qal", "perf", "impf", "imperf", "infin", "ptcp",
    "sing", "plur", "masc", "fem", "fern", "constr", "suff", "rem", "ibid", "op", "cit",
}


def english(low: str) -> bool:
    d = dictionary()
    if low in d and (len(low) > 2 or low in ("of", "or", "to", "in", "is", "as", "by", "be", "an", "it")):
        return True
    stems = (low[:-1], low[:-2], low[:-3], low[:-3] + "e", low[:-2] + "e", low[:-3] + "y")
    return len(low) >= 5 and any(len(x) >= 4 and x in d for x in stems)


def is_hebrewish(tok: str) -> bool:
    t = tok.strip(".,;:()[]!?'\"—-–*{}/\\")
    if not t or re.search(r"[\d§&]", t):
        return False
    low = t.lower()
    if low in NOT_HEBREW or low.rstrip(".") in NOT_HEBREW:
        return False
    if re.fullmatch(r"[a-z]{1,2}", t):  # paragraph letters, e, a, of
        return False
    if re.fullmatch(r"[A-Za-z]+", t) and english(low):
        return False
    if re.fullmatch(r"(niph|hiph|hoph|pi|pu|hithpa|hithpa|po|mil|k)'?[a-z]*", low.replace("^", "")):
        return False
    if re.fullmatch(r"[A-Z][a-z]{2,}", t):  # proper names: Ewald, Baer, Qimhi
        return False
    return True


def words(page: int) -> list[tuple[float, float, float, float, str]]:
    out = subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), "-bbox", str(SCAN), "-"],
                         capture_output=True, text=True).stdout
    ws = []
    for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', out):
        x0, y0, x1, y1 = map(float, m.groups()[:4])
        ws.append((x0, y0, x1, y1, html.unescape(m.group(5))))
    return ws


def hebrew_boxes(page: int) -> list[tuple[int, int, int, int]]:
    ws = words(page)
    if not ws:
        return []
    top = min(w[1] for w in ws)
    ws = [w for w in ws if w[1] > top + 8 and w[0] > 40]  # skip running head and margin letters
    # group into lines by y
    lines: list[list] = []
    for w in sorted(ws, key=lambda w: (round(w[1] / 4), w[0])):
        if lines and abs(lines[-1][0][1] - w[1]) < 3.5:
            lines[-1].append(w)
        else:
            lines.append([w])
    boxes = []
    for line in lines:
        line.sort(key=lambda w: w[0])
        run = None
        for w in line:
            heb = is_hebrewish(w[4])
            if heb and run and w[0] - run[2] < 6:
                run = [run[0], min(run[1], w[1]), w[2], max(run[3], w[3])]
            elif heb:
                if run:
                    boxes.append(run)
                run = [w[0], w[1], w[2], w[3]]
            elif run:
                boxes.append(run)
                run = None
        if run:
            boxes.append(run)
    out = []
    for x0, y0, x1, y1 in boxes:
        h = y1 - y0
        # the OCR layer's boxes sit low against the image: band upward
        out.append((int((x0 - 3) * SCALE), int((y0 - 1.2 * h) * SCALE),
                    int((x1 + 3) * SCALE), int((y1 + 0.4 * h) * SCALE)))
    return out


def sheet(page: int) -> list[pathlib.Path]:
    STRIPS.mkdir(parents=True, exist_ok=True)
    for old in STRIPS.glob(f"{page}-heb-*.png"):
        old.unlink()
    base = STRIPS / f"_h{page}"
    subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(DPI), "-png",
                    "-singlefile", str(SCAN), str(base)], check=True)
    full = base.with_suffix(".png")
    crops = []
    for i, (x0, y0, x1, y1) in enumerate(hebrew_boxes(page), 1):
        dst = STRIPS / f"_h{page}-{i:03}.png"
        subprocess.run(["magick", str(full), "-crop", f"{x1 - x0}x{y1 - y0}+{x0}+{y0}", "+repage",
                        "-resize", f"{int(ENLARGE * 100)}%", "-gravity", "north", "-splice", "0x34",
                        "-pointsize", "28", "-fill", "#C00000", "-annotate", "+0+2", str(i),
                        "-bordercolor", "white", "-border", "8", str(dst)], check=True)
        crops.append(dst)
    full.unlink()
    # pack rows, then pages of rows
    sizes = [tuple(map(int, subprocess.run(["magick", "identify", "-format", "%w %h", str(c)],
                                           capture_output=True, text=True).stdout.split())) for c in crops]
    rows, row, w = [], [], 0
    for c, (cw, ch) in zip(crops, sizes):
        if row and w + cw > SHEET_W:
            rows.append(row)
            row, w = [], 0
        row.append((c, ch))
        w += cw
    if row:
        rows.append(row)
    sheets, cur, hsum, made = [], [], 0, []
    for r in rows:
        rh = max(h for _, h in r)
        if cur and hsum + rh > SHEET_H:
            sheets.append(cur)
            cur, hsum = [], 0
        cur.append(r)
        hsum += rh
    if cur:
        sheets.append(cur)
    for k, rs in enumerate(sheets, 1):
        row_files = []
        for j, r in enumerate(rs):
            rf = STRIPS / f"_h{page}-row{k}-{j}.png"
            subprocess.run(["magick", *[str(c) for c, _ in r], "-background", "white",
                            "-gravity", "north", "+append", str(rf)], check=True)
            row_files.append(rf)
        dst = STRIPS / f"{page}-heb-{k}.png"
        subprocess.run(["magick", *map(str, row_files), "-background", "white", "-gravity", "west",
                        "-append", str(dst)], check=True)
        for rf in row_files:
            rf.unlink()
        made.append(dst)
    for c in crops:
        c.unlink()
    return made


def wiki_hebrew(text: str) -> list[str]:
    return [m.group(1) for m in re.finditer(r"\{\{GHGheb(?:T)?\|(?:text=|1=)?([^|}]*)", text)]


if __name__ == "__main__":
    for p in sheet(int(sys.argv[1])):
        print(p)
