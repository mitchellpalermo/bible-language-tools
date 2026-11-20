"""Render a verb paradigm (paradigms.py) as two Typst tables, one per printed
page of the original spread, each with its own row labels."""
from convert import Converter, esc, to_typst, tstr


def form_cell(cell) -> str:
    if cell is None:
        return None  # covered by a rowspan above
    import re
    text, _, span = cell.partition("|")
    m = re.fullmatch(r"(?:c(\d+))?r?(\d+)?", span)
    colspan = int(m.group(1) or 1)
    rowspan = int(m.group(2) or 1)
    if text == "—":
        body = ""
    elif text.startswith("~"):
        body = f"#text(fill: muted, style: \"italic\")[{esc(text[1:])}];"
    else:
        parts = []
        for f in text.split(", "):
            star = f.endswith("*")
            parts.append(f"#pform({tstr(f.rstrip('*'))}, {str(star).lower()});")
        body = "#box[" + ", ".join(parts) + "];"
    if colspan > 1 or rowspan > 1:
        return f"table.cell(colspan: {colspan}, rowspan: {rowspan}, align: center + horizon)[{body}]"
    return f"[{body}]"


def label(row) -> tuple[str, str]:
    sect, num, pers, gen = row[:4]
    a = " ".join(x for x in (sect, num) if x)
    b = " ".join(x for x in (pers.rstrip("."), gen.rstrip(".")) if x)
    return (f"#emph[{esc(a)}];" if a else "", f"{esc(b.split(' ')[0])} #emph[{esc(b.split(' ')[1])}];" if " " in b else esc(b))


def table(half: dict, caption: str) -> str:
    ncols = sum(n for _, n in half["group"])
    header = ["[]", "[]"] + [
        f"table.cell(colspan: {n}, align: center)[#text(fill: primary, weight: \"bold\")[{esc(name)}]]"
        for name, n in half["group"]]
    cells = []
    for row in half["rows"]:
        if row == "rule":
            cells.append(f"table.hline(stroke: 0.6pt + primary)")
            continue
        a, b = label(row)
        if isinstance(row[4], str):  # a full-width note row ("~Like Verbs …")
            cells.append(f"table.cell(colspan: {2 + ncols}, align: center){form_cell(row[4])}")
            continue
        if row[0].startswith("Shortened") and all(c == "—" for c in row[4]):
            cells.append(f"table.cell(colspan: {2 + ncols})[{a}]")
            continue
        if row[0].startswith("Shortened"):
            cells.append(f"table.cell(colspan: 2)[#box[{a}]]")
        else:
            cells += [f"[{a}]", f"[{b}]"]
        for c in row[4]:
            r = form_cell(c)
            if r is not None:
                cells.append(r)
    caption = half.get("caption", caption)
    note = f"#text(size: 7pt, fill: muted)[{conv_note(half['note'])}]\n" if half.get("note") else ""
    return (f"#ptable({tstr(caption)}, {ncols}, ("
            + ", ".join(header) + "), (" + ", ".join(cells) + ",));\n" + note)


def conv_note(wikitext: str) -> str:
    return to_typst(wikitext, Converter()).strip()


def wikitext_paradigm(p: dict) -> str:
    """Paradigms whose shape is not a verb grid (A: pronoun suffixes): each
    printed page is a wikitext table, rendered by the body converter."""
    conv = Converter()
    out = [f"#parhead({tstr(p['id'])}, {tstr(p['title'])});\n"]
    for i, (page, wt) in enumerate(zip(p["printed_pages"], p["tables"])):
        if i:
            out.append("#pagebreak(weak: true)\n")
        out.append(f"#origpage({tstr(page)});")
        out.append(to_typst(wt, conv))
    if p.get("note"):
        out.append("#text(size: 7.5pt)[" + to_typst(p["note"], conv).strip() + "]\n")
    for w in conv.warnings:
        print("WARN paradigm", p["id"], w)
    return "\n".join(out)


def paradigm(p: dict) -> str:
    if "tables" in p:
        return wikitext_paradigm(p)
    out = [f"#parhead({tstr(p['id'])}, {tstr(p['title'])});\n"]
    halves = [(p["left"], "Qal · Niphʿal · Piʿēl")]
    if "right" in p:
        halves.append((p["right"], "Puʿal · Hiphʿîl · Hophʿal · Hithpaʿēl"))
    for i, ((half, cap), page) in enumerate(zip(halves, p["printed_pages"])):
        if i:
            out.append("#pagebreak(weak: true)\n")
        out.append(f"#origpage({tstr(page)});")
        out.append(table(half, cap))
    return "\n".join(out)
