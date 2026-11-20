"""Enlarge spots of a strip to check pointing, stacked into one image.

    python3 tools/proof_zoom.py 230 3:1270,470,1460,520 2:730,820,900,880

Each spec is <strip>:<x0>,<y0>,<x1>,<y1> in the strip image's own pixels (the
coordinates you see when you read proof/strips/<page>-<strip>.png). Output:
proof/strips/<page>-zoom.png, each crop enlarged 3x and numbered in order.
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
STRIPS = ROOT / "proof" / "strips"


def main() -> None:
    page = sys.argv[1]
    parts = []
    for i, spec in enumerate(sys.argv[2:], 1):
        strip, box = spec.split(":")
        x0, y0, x1, y1 = map(int, box.split(","))
        dst = STRIPS / f"_{page}-z{i}.png"
        subprocess.run(["magick", str(STRIPS / f"{page}-{strip}.png"), "-crop",
                        f"{x1 - x0}x{y1 - y0}+{x0}+{y0}", "+repage", "-resize", "300%",
                        "-gravity", "west", "-splice", "60x0", "-pointsize", "40",
                        "-annotate", "+8+0", str(i), str(dst)], check=True)
        parts.append(str(dst))
    out = STRIPS / f"{page}-zoom.png"
    subprocess.run(["magick", *parts, "-background", "white", "-gravity", "west",
                    "-append", str(out)], check=True)
    for p in parts:
        pathlib.Path(p).unlink()
    print(out)


if __name__ == "__main__":
    main()
