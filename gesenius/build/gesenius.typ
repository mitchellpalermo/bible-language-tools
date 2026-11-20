// Gesenius' Hebrew Grammar — modern edition, styled after hebrew.tools.
// Design tokens are copied from apps/hebrew-tools/src/styles/global.css.

// Two editions from one source: the screen PDF in hebrew.tools colours, and a
// black-and-white print edition for print-on-demand (compile with
// `--input edition=print`). Colour is only ever set through these tokens.
#let is-print = sys.inputs.at("edition", default: "screen") == "print"
#let pick(screen, print) = if is-print { print } else { screen }

#let primary = pick(rgb("#15803D"), luma(15%))
#let primary-light = pick(rgb("#16A34A"), luma(30%))
#let accent = pick(rgb("#F59E0B"), luma(55%))
#let accent-light = pick(rgb("#FCD34D"), luma(80%))
#let coral = pick(rgb("#F43F5E"), luma(30%))
#let grape = pick(rgb("#7C3AED"), luma(40%))
#let jade = pick(rgb("#059669"), luma(50%))
#let bg = pick(rgb("#F0FDF4"), luma(94%))
#let ink = pick(rgb("#14532D"), luma(0%))
#let muted = pick(rgb("#6B7280"), luma(38%))
#let hebrew-ink = pick(rgb("#15803D"), luma(0%))
#let rule = pick(rgb("#BBF7D0"), luma(72%))

// hebrew.tools' rainbow accent line, as a Typst gradient (grey ramp in print)
#let accent-gradient = pick(gradient.linear(primary, grape, coral, accent, jade),
  gradient.linear(luma(15%), luma(60%), luma(15%)))

#let sans = ("Plus Jakarta Sans", "Noto Sans")
#let hebrew-font = "Noto Sans Hebrew"

// ── Inline helpers used by the converted text ─────────────────────────────
// Hebrew is wrapped in Unicode isolates (RLI … PDI), the equivalent of the
// app's per-span dir="rtl": a list like "A, B, C" keeps its reading order.
#let he(body) = text(font: hebrew-font, fill: hebrew-ink, size: 1.14em,
  [#"\u{2067}"#body#"\u{2069}"])
#let heblock(body) = block(width: 100%, spacing: 0.9em,
  align(right, text(font: hebrew-font, fill: hebrew-ink, size: 1.14em, lang: "he", dir: rtl, body)))
#let greek(body) = text(font: ("Noto Sans",), body)
#let arabic(body) = text(font: ("Geeza Pro", "Noto Sans"), body)
#let syriac(body) = text(font: ("Noto Sans Syriac", "Noto Sans"), body)
#let sc(body) = text(size: 0.82em, tracking: 0.04em, upper(body))
#let bref(s) = box(text(fill: ink, s))
// A note added by this edition, set apart from the 1910 text.
#let edition-aside(body) = block(width: 100%, above: 1.2em, fill: bg, radius: 4pt, inset: 8pt,
  stroke: (left: 2.5pt + accent), text(size: 8.4pt, body))
// A Babylonian (superlinear) vowel sign, which has no Unicode character: an image
// cropped from the 1910 page. The rule under each sign stands on the baseline.
#let babsign(path, width) = box(baseline: 0.12em, image(path, width: width))
#let missing() = text(fill: coral, weight: "bold", [\[Hebrew missing\]])

// A § cross-reference: a link when the target exists in this volume.
#let xref(target, body) = context {
  if query(target).len() > 0 { link(target, text(fill: primary, body)) } else { body }
}

// Margin-note machinery: place something in the outer (or inner) margin at
// the current line, whichever side that is on this page.
#let page-w = 6in
// print needs a wider gutter: KDP asks up to 0.875in inside (701–828 pages); 0.9in leaves
// room for vowel points and footnote numbers that stand a hair past the line
#let m-inside = pick(0.75in, 0.9in)
#let m-outside = 0.9in
#let in-margin(side: "outside", dy: 0pt, width: 0.62in, away: false, body) = context {
  let pos = here().position()
  let recto = calc.odd(here().page())
  let right-side = if side == "outside" { recto } else { not recto }
  let x = if right-side {
    page-w - (if recto { m-outside } else { m-inside }) + 0.14in
  } else {
    (if recto { m-inside } else { m-outside }) - 0.14in - width
  }
  box(width: 0pt, place(top + left, dx: x - pos.x, dy: dy,
    box(width: width, align(if right-side != away { left } else { right }, body))))
}

// Paragraph letter (§22 a, b, c …) in the outer margin, as Gesenius prints it.
#let ml(letter) = in-margin(dy: -0.62em,
  box(fill: bg, stroke: 0.6pt + rule, radius: 3pt, inset: (x: 3.5pt, y: 2pt),
    text(font: sans, size: 7.5pt, weight: "bold", fill: primary, style: "italic", letter)))

// Where a page of the 1910 printing began — for checking against the scan.
// Screen: inner margin. Print: the far edge of the outer margin, beside the paragraph
// letter but clear of it, and 0.3in from the trim — the inner margin is the gutter,
// which print-on-demand services ask to keep empty.
#let origpage(n) = if is-print {
  in-margin(side: "outside", dy: -0.5em, width: 0.46in, away: true,
  text(font: sans, size: 6pt, fill: muted, [p.#h(1pt)#n]))
} else {
  in-margin(side: "inside", dy: -0.5em, width: 0.5in,
  text(font: sans, size: 6pt, fill: muted, [p.#h(1pt)#n]))
}

// ── Footnotes ─────────────────────────────────────────────────────────────
// Numbered per page, as Gesenius prints them. The number is the footnote's place
// among the page's footnotes in reading order; resetting a counter in the header
// instead does not settle when a note sits at a page break.
#let fn-on-page(loc, inclusive) = {
  let p = loc.page()
  query(selector(std.footnote).before(loc, inclusive: inclusive)).filter(f => f.location().page() == p).len()
}
#let footnote(body) = {
  // a fixed-width marker: the number depends on which page the note lands on, and if
  // "1" and "3" differed in width, renumbering would reflow the line, move the note,
  // and Typst would never settle (Plus Jakarta Sans ignores tabular figures)
  box(width: 0.42em, context super(str(fn-on-page(here(), false) + 1)))
  std.footnote(numbering: (..n) => "", body)
}

// ── Headings ──────────────────────────────────────────────────────────────
// Heading levels: 1 Part, 2 Chapter, 3 sub-head inside a chapter
// (I. The Strong Verb, A. The Pure Stem …), 4 the numbered § sections.
// A heading's footnote is drawn by the heading's show rule, after the title,
// so it stays out of the contents list, the running heads and the bookmarks.
#let heading-note = state("heading-note", none)
#let with-note(note, h) = {
  if note != [] { heading-note.update(note) }
  h
  if note != [] { heading-note.update(none) }
}
#let the-note() = context { let n = heading-note.get(); if n != none { n } }
#let sec(num, title, note: []) = with-note(note, heading(level: 4, [§#h(0.25em)#num. #title]))
#let bookhead(level, title, note: []) = with-note(note, heading(level: level, title))

#let gtable(..args) = {
  set text(size: 8.5pt)
  set par(justify: false)
  block(width: 100%, align(center, table(
    stroke: (x, y) => (bottom: 0.4pt + rule),
    inset: (x: 4pt, y: 3.2pt),
    align: horizon,
    ..args)))
}

#let book(body) = {
  set document(title: "Gesenius' Hebrew Grammar", author: ("Wilhelm Gesenius", "Emil Kautzsch", "A. E. Cowley"))
  set page(
    width: page-w, height: 9in,
    margin: (inside: m-inside, outside: m-outside, top: 0.85in, bottom: 0.8in),
    header: context {
      let p = here().page()
      let sel = heading.where(level: 4).or(heading.where(level: 2)).or(heading.where(level: 1))
      let secs = query(sel.before(here()))
      let on-page = query(sel).filter(h => h.location().page() == p)
      if on-page.len() > 0 { secs = secs + on-page.slice(0, 1) }
      if secs.len() == 0 { return }
      if query(heading.where(level: 1)).any(h => h.location().page() == p) { return }
      set text(font: sans, size: 7.5pt, fill: muted)
      let s = secs.last()
      if calc.odd(p) {
        align(right, [#s.body])
      } else {
        align(left, [Gesenius’ Hebrew Grammar])
      }
      v(-4pt)
      line(length: 100%, stroke: 0.5pt + rule)
    },
    footer: context {
      let p = here().page()
      set text(font: sans, size: 8pt, weight: "bold", fill: primary)
      align(if calc.odd(p) { right } else { left }, counter(page).display())
    },
  )
  set text(font: sans, size: 9.4pt, fill: ink, lang: "en", region: "gb", hyphenate: true)
  // print: no hanging punctuation, so nothing crosses into the gutter
  set text(overhang: not is-print)
  set par(justify: true, leading: 0.62em, spacing: 0.85em, first-line-indent: 0pt)
  set std.footnote.entry(separator: line(length: 25%, stroke: 0.5pt + rule), gap: 0.45em, indent: 0pt)
  show std.footnote.entry: set text(size: 7.8pt)
  show std.footnote.entry: set par(leading: 0.5em)
  // footnotes are numbered afresh on each page, as in 1910 (see `footnote` above)
  // only the number needs context; the body stays outside it so a long note can break across pages
  show std.footnote.entry: it => [#box(width: 0.55em, context super(str(fn-on-page(it.note.location(), true))))#it.note.body]
  show emph: set text(style: "italic")

  show heading.where(level: 1): it => {
    pagebreak(weak: true, to: "odd")
    v(1.2in)
    block(width: 100%, height: 3pt, fill: accent-gradient)
    v(0.25in)
    set par(justify: false)
    text(font: sans, size: 22pt, weight: "extrabold", fill: primary, tracking: -0.01em, hyphenate: false, [#it.body#the-note()])
    v(0.35in)
  }
  show heading.where(level: 2): it => {
    v(0.25in)
    block(width: 100%, inset: (x: 0pt, y: 6pt), below: 0.2in, {
      set par(justify: false)
      text(font: sans, size: 13pt, weight: "extrabold", fill: primary, hyphenate: false, [#it.body#the-note()])
      v(-2pt)
      block(width: 1.2in, height: 2pt, fill: accent)
    })
  }
  show heading.where(level: 3): it => {
    block(above: 1.8em, below: 0.9em, breakable: false, width: 100%, {
      set par(justify: false)
      align(center, text(font: sans, size: 9.5pt, weight: "bold", fill: primary, tracking: 0.04em, hyphenate: false, [#it.body#the-note()]))
    })
  }
  show heading.where(level: 4): it => {
    block(above: 1.5em, below: 1.0em, breakable: false, width: 100%,
      fill: bg, radius: 4pt, inset: (x: 8pt, y: 7pt), stroke: (left: 3pt + primary),
      text(font: sans, size: 11pt, weight: "bold", fill: primary, [#it.body#the-note()]))
  }
  body
}

// ── Paradigms ─────────────────────────────────────────────────────────────
#let pform(f, star) = box({
  text(font: hebrew-font, fill: hebrew-ink, size: 1.22em, [#"\u{2067}"#f#"\u{2069}"])
  if star { text(fill: accent, weight: "bold", size: 0.9em, baseline: -0.3em, [\*]) }
})
#let parhead(id, title) = heading(level: 2, [Paradigm #id. #title])
#let ptable(caption, ncols, header, cells) = {
  set text(size: 7.6pt)
  set par(justify: false)
  block(width: 100%, breakable: false, {
    text(font: sans, size: 7.5pt, weight: "bold", fill: muted, tracking: 0.05em, upper(caption))
    v(2pt)
    table(
      columns: (auto, 1fr) + (auto,) * ncols,
      gutter: 0pt,
      stroke: none,
      inset: (x: 3pt, y: 2.6pt),
      align: (x, y) => if x < 2 { left + horizon } else { right + horizon },
      fill: (x, y) => if y > 0 and calc.even(y) { bg } else { none },
      table.header(..header),
      table.hline(stroke: 0.6pt + primary),
      ..cells,
    )
  })
}

// ── Indexes ───────────────────────────────────────────────────────────────
#let index-intro(body) = block(width: 100%, below: 1em,
  align(center, text(size: 8pt, style: "italic", fill: muted, body)))
#let index-cols(n, body) = {
  set text(size: 7.6pt)
  set par(justify: false, leading: 0.42em, spacing: 0.32em, hanging-indent: 1em)
  columns(n, gutter: 14pt, body)
}
#let igap() = v(0.55em, weak: true)
#let pbook(name) = block(above: 0.9em, below: 0.35em, sticky: true,
  text(weight: "bold", fill: primary, size: 8.2pt, name))
#let prow(ch, v, refs) = block(above: 0.22em, below: 0.22em, breakable: false,
  grid(columns: (1.5em, 1.7em, 1fr), column-gutter: 3pt,
    text(weight: "bold", fill: primary, ch), align(right, v), refs))
