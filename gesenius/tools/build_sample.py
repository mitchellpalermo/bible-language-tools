"""Build the short sample: front matter, §22, Paradigm B."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from convert import Converter, assemble, slice_section, to_typst
from frontmatter import write_qr, title_page, verso, edition_note, contents
from paradigms import PARADIGM_B
from render_paradigm import paradigm

ws = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
pages = json.loads((ws / "pages.json").read_text())
additions = json.loads((ws / "additions.json").read_text())
conv = Converter(additions=additions)

write_qr(str(out / "scan-qr.svg"))
full = assemble(pages, list(range(99, 105)))
import re
a = re.search(r'<section begin="?par22"?\s*/>', full).start()
b = re.search(r'<section begin="?par23"?\s*/>', full).start()
wikitext = full[a:b]
s22 = to_typst(wikitext, conv)

doc = ['#import "gesenius.typ": *', "#show: book", title_page(), verso(), edition_note("scan-qr.svg", sample=True), contents()]
doc.append("#counter(page).update(1)\n")
doc.append("= First Part: Elementary Principles, or the Sounds and Characters\n")
doc.append("== Chapter II. Peculiarities and Changes of Letters: the Syllable and the Tone\n")
doc.append(s22)
doc.append("= Paradigms\n")
doc.append(paradigm(PARADIGM_B))
(out / "sample.typ").write_text("\n".join(doc))
for w in conv.warnings: print("WARN", w)
