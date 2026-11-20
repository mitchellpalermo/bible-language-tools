"""Wikisource wikitext (Gesenius' Hebrew Grammar, 1910) -> Typst markup.

Works from the Page: namespace wikitext, not the rendered HTML, because the
GHG module's renderer drops every verse number (`if not verse then` in
Module:GHG bibleRef) and because the templates carry the semantics we want to
style: GHGheb is Hebrew, GHGpar a § cross-reference, GHGmargin-letter a
paragraph letter, GHGbible-ref a Scripture reference.

Every emitted embedded expression ends in `;` so the text that follows it can
never be parsed as a method call or a trailing argument (`#emph[i].e.`).
"""
from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass, field

import mwparserfromhell as mw
from mwparserfromhell.nodes import (Comment, ExternalLink, Heading, HTMLEntity,
                                    Tag, Template, Text, Wikilink)

from modernize import modernize

PAGE_OPEN, PAGE_CLOSE = "", ""  # original-page marker, survives parsing
PARA = ""  # paragraph break placeholder

ROMAN_PAGES = {5: "i", 6: "ii", 7: "iii", 8: "iv", 9: "v", 10: "vi", 11: "vii", 12: "viii",
               13: "ix", 14: "x", 15: "xi", 16: "xii", 17: "xiii", 18: "xiv", 19: "xv",
               20: "xvi", 21: "xvii", 22: "xviii", 23: "xix"}


def printed_page(djvu: int) -> str:
    if djvu in ROMAN_PAGES:
        return ROMAN_PAGES[djvu]
    return str(djvu - 24)


# ── Scripture references: Gesenius' abbreviations -> SBL style ──────────────
SBL = {
    "Gn": "Gen", "Gen": "Gen", "Gn.": "Gen", "Ex": "Exod", "Lv": "Lev", "Lev": "Lev", "Lv.": "Lev",
    "Nu": "Num", "Dt": "Deut", "Dt.": "Deut", "Jos": "Josh", "Ju": "Judg", "Jud": "Judg",
    "Ju.": "Judg", "1 S": "1 Sam", "2 S": "2 Sam", "1 K": "1 Kgs", "2 K": "2 Kgs", "Is": "Isa",
    "Is.": "Isa", "Jer": "Jer", "Je": "Jer", "Jer.": "Jer", "Ez": "Ezek", "Ez.": "Ezek",
    "Eze": "Ezek", "Hos": "Hos", "Ho": "Hos", "Jo": "Joel", "Joel": "Joel", "Am": "Amos",
    "Amos": "Amos", "Ob": "Obad", "Jon": "Jonah", "Jn": "Jonah", "Mi": "Mic", "Mic": "Mic",
    "Na": "Nah", "Nah": "Nah", "Hb": "Hab", "Hab": "Hab", "Zp": "Zeph", "Hag": "Hag",
    "Zc": "Zech", "Mal": "Mal", "Mal.": "Mal", "Ps": "Ps", "PsPs": "Pss", "Pr": "Prov",
    "Jb": "Job", "Job": "Job", "Ct": "Song", "Cant": "Song", "Ru": "Ruth", "La": "Lam",
    "Lam": "Lam", "Ec": "Eccl", "Est": "Esth", "Dn": "Dan", "Ezr": "Ezra", "Neh": "Neh",
    "Ne": "Neh", "1 Ch": "1 Chr", "1 Chr": "1 Chr", "2 Ch": "2 Chr", "2 Chr": "2 Chr",
    "3 Ezr": "1 Esd", "1 Macc.": "1 Macc", "Ecclus": "Sir", "Sirac": "Sir",
    "St. Mark": "Mark", "Mark": "Mark", "John": "John", "Acts": "Acts", "Rv": "Rev",
}


def format_verses(v: str) -> str:
    """'5.7' -> '5, 7';  '5 f.' -> '5f.';  '5–7' stays."""
    v = v.strip()
    v = re.sub(r"\s*\bff\.", "ff.", v)
    v = re.sub(r"\s*\bf\.", "f.", v)
    v = re.sub(r"(\d)\s+f$", r"\1f.", v)
    v = re.sub(r"\.(?=\d)", ", ", v)  # Gesenius separates verses with a raised dot
    v = v.replace("-", "–")
    return v


def bible_ref(book: str, chapter: str, verse: str | None, hide: str | None) -> str:
    book = re.sub(r"<!--.*?-->", "", book).strip()
    name = SBL.get(book, book)
    verses = format_verses(verse) if verse else ""
    if hide == "completely":
        return verses
    if hide and hide.startswith("v"):
        return f"{hide}. {verses}".strip()
    loc = chapter + (":" + verses if verses else "")
    if book == "Ob":  # one chapter; Gesenius cites the verse alone
        loc = verses or chapter
    if hide:  # continuing a list: "Gen 1:2, 3:4"
        return loc
    return f"{name} {loc}"


# ── Typst escaping ───────────────────────────────────────────────────────────
_ESC = re.compile(r"([\\#$*_`<>@\[\]~=\-+/])")


def esc(s: str) -> str:
    return _ESC.sub(r"\\\1", s)


def tstr(s: str) -> str:
    """A Typst string literal."""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


@dataclass
class Ctx:
    hebrew: bool = False
    no_modernize: bool = False


@dataclass
class Converter:
    """Converts parsed wikitext nodes to Typst markup."""

    additions: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)
    footnotes: dict = field(default_factory=dict)

    # ── nodes ────────────────────────────────────────────────────────────
    def nodes(self, nodes, ctx: Ctx) -> str:
        return "".join(self.node(n, ctx) for n in nodes)

    def wikicode(self, code, ctx: Ctx) -> str:
        if code is None:
            return ""
        return self.nodes(code.nodes, ctx)

    def node(self, n, ctx: Ctx) -> str:
        if isinstance(n, Text):
            return self.text(str(n), ctx)
        if isinstance(n, Comment):
            return ""
        if isinstance(n, HTMLEntity):
            return self.text(html.unescape(str(n)), ctx)
        if isinstance(n, Template):
            return self.template(n, ctx)
        if isinstance(n, Tag):
            return self.tag(n, ctx)
        if isinstance(n, Wikilink):
            return self.wikicode(n.text, ctx) if n.text else self.text(str(n.title).split("/")[-1], ctx)
        if isinstance(n, ExternalLink):
            return self.wikicode(n.title, ctx) if n.title else ""
        if isinstance(n, Heading):
            return PARA + self.wikicode(n.title, ctx) + PARA
        self.warnings.append(f"unhandled node {type(n).__name__}: {str(n)[:60]}")
        return self.text(str(n), ctx)

    def text(self, s: str, ctx: Ctx) -> str:
        # page markers pass straight through as Typst calls
        parts = re.split(f"{PAGE_OPEN}(.*?){PAGE_CLOSE}", s)
        out = []
        for i, part in enumerate(parts):
            if i % 2 == 1:
                out.append(f"#origpage({tstr(part)}) <orig-{part}>")  # no ";" after a label: Typst prints it
                continue
            part = re.sub(r"\n\s*\n+", PARA, part)
            part = part.replace("\n", " ")
            if not (ctx.hebrew or ctx.no_modernize):
                part = modernize(part)
            out.append(esc(part))
        return "".join(out)

    # ── templates ────────────────────────────────────────────────────────
    def arg(self, t: Template, key, ctx: Ctx, default=None):
        if not t.has(key):
            return default
        return self.wikicode(t.get(key).value, ctx).strip()

    def raw(self, t: Template, key, default=None):
        if not t.has(key):
            return default
        return re.sub(r"<!--.*?-->", "", str(t.get(key).value)).strip()

    def template(self, t: Template, ctx: Ctx) -> str:
        name = str(t.name).strip()
        heb = Ctx(hebrew=True, no_modernize=True)
        if name in ("GHGheb", "hebrew"):
            body = self.arg(t, "text", heb) if t.has("text") else self.arg(t, "1", heb)
            out = f"#he[{body}];" + (" " if t.has("indexitem") else "")
            pron = self.arg(t, "pron", Ctx(no_modernize=True))
            if pron:
                out += f" #emph[{pron}];"
            tr = self.arg(t, "translate", ctx)
            if tr:
                out += f" #emph[{tr}];"
            return out
        if name == "GHGhebT":
            body = self.arg(t, "text", heb)
            return f"{PARA}#heblock[{body}];{PARA}"
        if name == "GHGbible-ref":
            ref = bible_ref(self.raw(t, "book"), self.raw(t, "chapter"), self.raw(t, "verse"),
                            self.raw(t, "hidebook"))
            return f"#bref({tstr(ref)});"
        if name == "GHGpar":
            num, letter, ab = self.raw(t, "1", ""), self.raw(t, "2"), self.raw(t, "3", "")
            nonum = self.raw(t, "nonumber") is not None
            sign = "" if self.raw(t, "nosign") is not None else ("§§" if self.raw(t, "doublesign") is not None else "§")
            target = f"p{num}{ab}{letter}" if letter else f"s{num}{ab}"
            shown = "" if nonum else f"{sign}{' ' if sign else ''}{num}{f'#super[{ab}];' if ab else ''}"
            if letter:  # Gesenius sets "§ 22 c": a thin space between number and letter
                shown += ("#h(0.18em)" if shown else "") + f"#emph[{esc(letter)}];"
            return f"#xref(<{target}>)[{shown}];"
        if name == "GHGmargin-letter":
            num, letter, ab = self.raw(t, "1"), self.raw(t, "2"), self.raw(t, "3", "")
            return f"{PARA}#ml({tstr(letter)}) <p{num}{ab}{letter}>"
        if name in ("GHGterm", "GHGtranslate", "GHGcite", "GHGpron"):
            return f"#emph[{self.arg(t, '1', ctx) if not t.has('title') else self.arg(t, 'title', ctx)}];"
        if name == "GHGtranslit":
            return {
                'a-brev-acut': 'ắ', 'a-dier-brev': 'ä̆', 'a-dier-macr': 'ǟ', 'a-di-ma-ac': 'ǟ́',
                'a-macr-acut': 'ā́', 'a-ring-macr': 'å̄', 'a-ring-brev': 'å̆', 'a-ring-circ': 'å̂',
                'u-inv-brev': 'u̯', 'i-inv-brev': 'i̯'}.get(self.raw(t, "1"), "")
        if name == "GHGpage":  # a 1910 page number: link it to that page's margin marker
            v = self.raw(t, "1", "")
            return f"#xref(<orig-{v}>)[{esc(v)}];" if re.fullmatch(r"[0-9ivxl]+", v) else esc(v)
        if name == "GHGpar-heading":
            return self.par_heading(t, ctx)
        if name == "GHGbookhead":
            # a Part / Chapter / sub-head that the build put in place of the 1910 centred block
            level, title = self.raw(t, "1"), self.arg(t, "2", ctx, "")
            key = self.raw(t, "note")
            note = self.wikicode(mw.parse(self.footnotes[key]), ctx).strip() if key else ""
            return f"{PARA}#bookhead({level}, [{title}], note: [{f'#footnote[{note}];' if note else ''}]);{PARA}"
        if name == "GHGbabsign":  # a Babylonian vowel sign Unicode cannot encode (scan 66–67)
            return f"#babsign({tstr(self.raw(t, '1', ''))}, {self.raw(t, '2', '0.15in')});"
        if name == "GHGimage":  # an image the build cropped from the scan
            return f"{PARA}#figure(image({tstr(self.raw(t, '1'))}, width: {self.raw(t, '2', '100%')}));{PARA}"
        if name == "GHGmargin-letter-fmt":
            return f"#emph[{esc(self.raw(t, '1', ''))}];"
        if name in ("abbr",):
            return self.arg(t, "1", ctx, "")
        if name in ("nowrap", "Nowrap"):
            return f"#box[{self.arg(t, '1', ctx, '')}];"
        if name in ("center", "c"):
            return f"{PARA}#align(center)[{self.arg(t, '1', ctx, '')}];{PARA}"
        if name in ("polytonic", "Polytonic"):
            return f"#greek[{self.arg(t, '1', Ctx(no_modernize=True), '')}];"
        if name == "lang":
            body = self.arg(t, "text", Ctx(no_modernize=True)) if t.has("text") else self.arg(t, "2", Ctx(no_modernize=True), "")
            return f"#emph[{body}];" if "''" not in str(t) else body
        if name == "arabic":
            return f"#arabic[{self.arg(t, '1', Ctx(no_modernize=True), '')}];"
        if name == "syriac":
            return f"#syriac[{self.arg(t, 'text', Ctx(no_modernize=True), '')}];"
        if name in ("smaller",):
            return f"#text(size: 0.9em)[{self.arg(t, '1', ctx, '')}];"
        if name in ("larger",):
            return f"#text(size: 1.15em)[{self.arg(t, '1', ctx, '')}];"
        if name == "fs":
            return self.arg(t, "2", ctx, "")
        if name in ("Small-caps", "smallcaps", "asc"):
            return f"#sc[{self.arg(t, '1', ctx, '')}];"
        if name == "sup":
            return f"#super[{self.arg(t, '1', ctx, '')}];"
        if name == "normal":
            return f"#text(style: \"normal\")[{self.arg(t, '1', ctx, '')}];"
        if name == "hebrew missing":
            return "#missing();"
        if name in ("GHGcritic", "GHGcritic-tech", "GHGcorrected", "rh", "ts", "Font-size90%/s",
                    "Font-size90%/e", "Smaller block/s", "Smaller block/e", "smaller block/s",
                    "smaller block/e", "smallrefs", "nopt", "nop"):
            return PARA if name in ("nop",) else ""
        if name in ("GHGaleph",):
            return "ʾ"
        if name == "GHGvowel-holder":
            return f"#he[{self.arg(t, '1', heb, '')}];"
        if name == "Asterism":
            return f"{PARA}#align(center)[⁂];{PARA}"
        if name == "'":
            return "’"
        if name == "!":
            return "|"
        if name == "=":
            return "\\="
        if name.startswith(":Gesenius' Hebrew Grammar/Additions and Corrections/") or name.startswith("#section:Gesenius"):
            return self.addition(name, self.raw(t, "1"), ctx)
        if name in ("colbegin", "colend"):
            return PARA
        self.warnings.append(f"unhandled template {name}")
        return self.arg(t, "1", ctx, "")

    def addition(self, name: str, section: str | None, ctx: Ctx) -> str:
        key = "Gesenius' Hebrew Grammar/Additions and Corrections/" + name.rsplit("/", 1)[1]
        text = self.additions.get(key, "")
        text = re.sub(r"<noinclude>.*?</noinclude>", "", text, flags=re.S)
        if section:
            m = re.search(rf'<section begin="?{re.escape(section)}"?\s*/>(.*?)<section end="?{re.escape(section)}"?\s*/>', text, re.S)
            text = m.group(1) if m else ""
        return self.wikicode(mw.parse(text), ctx)

    def par_heading(self, t: Template, ctx: Ctx) -> str:
        num, ab = self.raw(t, "1"), self.raw(t, "3", "")
        title_code = t.get("2").value if t.has("2") else None
        if t.has("4"):
            # the 4th slot carries the rest of the title (§66 "e.g. נָגַשׁ", §133's closing
            # italics) and/or the heading's footnote; join it to the title before parsing
            raw2 = str(title_code) if title_code is not None else ""
            raw4 = str(t.get("4").value)
            if raw2.count("''") % 2 == 0:  # a stray closing '' (§133) would open italics instead
                raw4 = re.sub(r"''(?!')", "", raw4) if "<ref" not in raw4 else raw4
            text4 = re.sub(r"<ref.*?</ref>", "", raw4, flags=re.S)
            sep = "." if text4.startswith(" ") and text4.strip() and re.search(r"[A-Za-z]$", raw2.rstrip()) else ""
            title_code = mw.parse(raw2 + sep + raw4)
        note = ""
        title = ""
        if title_code is not None:
            # a footnote on a heading is rendered beside it, not inside the outline entry
            refs = [n for n in title_code.nodes if isinstance(n, Tag) and str(n.tag).lower() == "ref"]
            for r in refs:
                note += f"#footnote[{self.wikicode(r.contents, ctx)}];"
            title = self.nodes([n for n in title_code.nodes if n not in refs], ctx).strip()
        title = title.rstrip(". ").strip()
        return f"{PARA}#sec({tstr(num + ab)}, [{title}], note: [{note}]) <s{num}{ab}>{PARA}"

    # ── tags ─────────────────────────────────────────────────────────────
    def tag(self, t: Tag, ctx: Ctx) -> str:
        name = str(t.tag).lower().strip()
        body = lambda c=ctx: self.wikicode(t.contents, c) if t.contents is not None else ""
        if name == "i":
            return f"#emph[{body()}];"
        if name == "b":
            return f"#strong[{body()}];"
        if name == "sup":
            return f"#super[{body()}];"
        if name == "sub":
            return f"#sub[{body()}];"
        if name in ("small",):
            return f"#text(size: 0.88em)[{body()}];"
        if name in ("big",):
            return f"#text(size: 1.15em)[{body()}];"
        if name == "u":
            return f"#underline[{body()}];"
        if name == "ref":
            if t.has("follow"):
                return ""  # merged into the original note by assemble()
            return f"#footnote[{body().strip()}];"
        if name in ("section", "references", "pagequality", "noinclude"):
            return ""
        if name == "br":
            return " #linebreak();"
        if name == "hr":
            return f"{PARA}#line(length: 30%, stroke: 0.5pt + muted);{PARA}"
        if name == "span":
            return body()
        if name == "div":
            style = str(t.get("style").value) if t.has("style") else ""
            align = str(t.get("align").value).strip() if t.has("align") else ""
            inner = body()
            if "center" in style or align == "center":
                return f"{PARA}#align(center)[{inner}];{PARA}"
            if t.has("dir") and "rtl" in str(t.get("dir").value):
                return f"{PARA}#heblock[{inner}];{PARA}"
            return f"{PARA}{inner}{PARA}"
        if name == "table":
            return PARA + self.table(t, ctx) + PARA
        if name == "poem":
            lines = body().strip().split(" ")
            return PARA + body().replace(PARA, " #linebreak();") + PARA
        if name in ("dd", "dt"):
            return f"{PARA}#pad(left: 1.5em)[{body()}];{PARA}"
        if name in ("ol", "ul"):
            return PARA + body() + PARA
        if name == "li":
            return f"{PARA}#pad(left: 1.5em)[{body()}];{PARA}"
        if name == "nowiki":
            return esc(str(t.contents))
        self.warnings.append(f"unhandled tag {name}")
        return body()

    # ── tables ───────────────────────────────────────────────────────────
    def table_rows(self, t: Tag, ctx: Ctx):
        """Return rows as lists of (markup, colspan, rowspan, align, is_header)."""
        rows = []
        for child in t.contents.nodes:
            if not (isinstance(child, Tag) and str(child.tag).lower() == "tr"):
                continue
            cells = []
            for c in child.contents.nodes:
                if not (isinstance(c, Tag) and str(c.tag).lower() in ("td", "th")):
                    continue
                attr = lambda k: str(c.get(k).value).strip().strip('"') if c.has(k) else None
                colspan = int(attr("colspan") or 1)
                rowspan = int(attr("rowspan") or 1)
                align = attr("align")
                style = attr("style") or ""
                m = re.search(r"text-align:\s*(\w+)", style)
                if m:
                    align = m.group(1)
                markup = self.wikicode(c.contents, ctx).replace(PARA, " ").strip()
                cells.append((markup, colspan, rowspan, align, str(c.tag).lower() == "th"))
            rows.append(cells)
        # a header row before the first |- is not wrapped in <tr> by the parser
        return rows

    def table(self, t: Tag, ctx: Ctx) -> str:
        rows = self.table_rows(t, ctx)
        rows = [r for r in rows if r]
        if not rows:
            return ""
        ncols = grid_width(rows)
        cells = []
        for r in rows:
            for markup, cs, rs, align, header in r:
                opts = []
                if cs > 1:
                    opts.append(f"colspan: {cs}")
                if rs > 1:
                    opts.append(f"rowspan: {rs}")
                if align in ("left", "right", "center"):
                    opts.append(f"align: {align}")
                content = f"#strong[{markup}];" if header and markup else markup
                cells.append(f"table.cell({', '.join(opts)})[{content}]" if opts else f"[{content}]")
        return f"#gtable(columns: {ncols}, {', '.join(cells)});"


def grid_width(rows) -> int:
    occupied: dict[tuple[int, int], bool] = {}
    width = 0
    for ri, r in enumerate(rows):
        ci = 0
        for _, cs, rs, _, _ in r:
            while occupied.get((ri, ci)):
                ci += 1
            for dr in range(rs):
                for dc in range(cs):
                    occupied[(ri + dr, ci + dc)] = True
            ci += cs
        width = max(width, ci)
        while occupied.get((ri, width)):
            width += 1
    return max(width, 1)


# ── assembling pages ────────────────────────────────────────────────────────
SIMPLE_TEMPLATES = {
    "{{מתג}}": "ֽ", "{{פתח}}": "ַ", "{{שווא}}": "ְ",
    "{{זונג}}": "‌", "{{מפריד תווים}}": "͏",
    "{{GHGparad-q-cstr}}": '| align="center" | \'\'"\'\'\n| align="left" | \'\'construct\'\'',
    "{{GHGparad-q-light-suff}}": '| align="center" | \'\'"\'\'\n| align="left" | \'\'with light suff.\'\'',
    "{{GHGparad-q-grave-suff}}": '| align="center" | \'\'"\'\'\n| align="left" | \'\'with grave suff.\'\'',
    "{{GHGparad-sg-abs}}": '| align="left" | \'\'Sing.\'\'\n| align="left" | \'\'absolute\'\'',
    "{{GHGparad-pl-abs}}": '| align="left" | \'\'Plur.\'\'\n| align="left" | \'\'absolute\'\'',
    "{{GHGparad-dual-abs}}": '| align="left" | \'\'Dual\'\'\n| align="left" | \'\'absolute\'\'',
}


def page_body(djvu: int, text: str) -> str:
    text = re.sub(r"<noinclude>.*?</noinclude>", "", text, flags=re.S)
    for k, v in SIMPLE_TEMPLATES.items():
        text = text.replace(k, v)
    # words hyphenated across a page break: keep the whole word at the start
    text = re.sub(r"\{\{(?:hws|Hyphenated word start|hyphenated word start)\|([^|}]*)\|([^|}]*)(?:\|[^}]*)?\}\}", r"\2", text)
    # the word's end is dropped (its start already carries the whole word); quote
    # markup wrapped around the end alone must go too, or the empty pair of
    # italic marks left behind (four apostrophes) reads as an opening bold
    text = re.sub(r"('{2,5})\{\{(?:hwe|Hyphenated word end|hyphenated word end)\|[^|}]*\|[^|}]*\}\}\1", "", text)
    text = re.sub(r"\{\{(?:hwe|Hyphenated word end|hyphenated word end)\|([^|}]*)\|([^|}]*)\}\}", "", text)
    return text


def assemble(pages: dict, djvus: list[int]) -> str:
    """Concatenate pages in order, with an original-page marker at each start."""
    chunks = []
    for n in djvus:
        body = page_body(n, pages[str(n)]["text"])
        marker = f"{PAGE_OPEN}{printed_page(n)}{PAGE_CLOSE}"
        # keep a marker out of a template or tag that opens the page
        body = marker + body if not body.lstrip().startswith(("{|", "<section")) else _after_section(body, marker)
        chunks.append(body)
    text = ""
    for c in chunks:
        # Wikisource joins pages with a space; a page that begins a paragraph starts with a blank line
        text = text.rstrip(" ") + (" " if not text.endswith("\n") else "") + c
    return merge_followed_refs(text)


def _after_section(body: str, marker: str) -> str:
    m = re.match(r"(\s*(?:<section[^>]*/>\s*)*)", body)
    head = m.group(1)
    rest = body[len(head):]
    if rest.startswith("{|"):
        return head + rest  # tables at page top: marker emitted by the caller elsewhere
    return head + marker + rest


def merge_followed_refs(text: str) -> str:
    """<ref name=X>..</ref> continued by <ref follow=X>..</ref> on the next page."""
    follows = {}
    def grab(m):
        follows[m.group(1)] = m.group(2)
        return ""
    text = re.sub(r'<ref\s+follow\s*=\s*"?([^">]+?)"?\s*>(.*?)</ref>', grab, text, flags=re.S)
    for name, cont in follows.items():
        pat = re.compile(r'(<ref\s+name\s*=\s*"?' + re.escape(name) + r'"?\s*>)(.*?)(</ref>)', re.S)
        text, n = pat.subn(lambda m: m.group(1) + m.group(2).rstrip() + " " + cont.lstrip() + m.group(3), text, count=1)
    return text


def to_typst(wikitext: str, conv: Converter) -> str:
    code = mw.parse(wikitext)
    out = conv.wikicode(code, Ctx())
    # tidy paragraph structure
    paras = [p.strip() for p in out.split(PARA)]
    paras = [re.sub(r"[ \t]{2,}", " ", p) for p in paras if p]
    paras = [re.sub(r"^(\d+)\.(\s)", r"\1\\.\2", p) for p in paras]
    return "\n\n".join(paras) + "\n"


def slice_section(text: str, sec: str) -> str:
    m = re.search(rf'<section begin="?{re.escape(sec)}"?\s*/>', text)
    start = m.start() if m else 0
    # keep the page marker that precedes the section begin
    back = text.rfind(PAGE_OPEN, 0, start)
    if back != -1 and text.find(PAGE_CLOSE, back) < start and not text[text.find(PAGE_CLOSE, back) + 1:start].strip():
        start = back
    e = re.search(rf'<section end="?{re.escape(sec)}"?\s*/>', text[start:])
    end = start + e.end() if e else len(text)
    return text[start:end]
