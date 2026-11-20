"""Crop an index page into readable column pieces (Protocol C).

    python3 tools/proof_cols.py 573        # 3 columns (Index of Hebrew Words)
    python3 tools/proof_cols.py 557 2      # 2 columns (Subjects, Passages)
    python3 tools/proof_cols.py 582 3 6    # 6 parts per column, for small pointing
    python3 tools/proof_cols.py 591 3 4 70 # shift the column grid 70 px right

The fourth argument shifts the column grid right (negative: left) when the
trim kept a gutter shadow and the columns no longer fall on even thirds —
check that each strip's right edge shows complete section letters.
Renders the scan page at its native 400 dpi, trims the margin, and writes
proof/strips/<page>-<col><part>.png — columns A, B, C, each in overlapping
vertical parts (3 by default) — small enough to read the pointing. Use 6
parts on the Hebrew-word index: at 3 parts the image is shown downscaled and
small vowels blur. Also writes
the scan's own OCR per column to proof/strips/<page>-<col>.txt as a typing aid
(English is usable; its Hebrew is not).
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCAN = ROOT / "scan" / "geseniushebrewgr00geseuoft.pdf"
OUT = ROOT / "proof" / "strips"


def run(*a: str) -> str:
    return subprocess.run(a, check=True, capture_output=True, text=True).stdout


def main() -> None:
    page = int(sys.argv[1])
    ncol = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    nparts = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    shift = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    OUT.mkdir(parents=True, exist_ok=True)
    full = OUT / f"{page}-full"
    run("pdftoppm", "-f", str(page), "-l", str(page), "-r", "400", "-png", "-singlefile", str(SCAN), str(full))
    trim = OUT / f"{page}-trim.png"
    run("magick", f"{full}.png", "-fuzz", "15%", "-trim", "+repage", str(trim))
    w, h = map(int, run("magick", "identify", "-format", "%w %h", str(trim)).split())
    cw, part = w // ncol, (h + nparts - 1) // nparts
    for i in range(ncol):
        col = "ABC"[i]
        x = max(0, i * cw - 40 + shift)
        for k in range(nparts):
            y = max(0, k * part - 50)
            run("magick", str(trim), "-crop", f"{cw + 40}x{part + 50}+{x}+{y}", "+repage",
                str(OUT / f"{page}-{col}{k + 1}.png"))
    info = run("pdfinfo", "-f", str(page), "-l", str(page), str(SCAN))
    pw, ph = next(map(float, l.split()[3:6:2]) for l in info.splitlines() if "size:" in l)
    for i in range(ncol):
        run("pdftotext", "-f", str(page), "-l", str(page), "-r", "72", "-x", str(int(i * pw / ncol)), "-y", "0",
            "-W", str(int(pw / ncol)), "-H", str(int(ph)), str(SCAN), str(OUT / f"{page}-{'ABC'[i]}.txt"))
    print(f"{page}: {ncol} columns, trimmed {w}x{h}; read proof/strips/{page}-A1.png …")


if __name__ == "__main__":
    main()
