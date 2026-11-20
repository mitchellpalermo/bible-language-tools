// The print edition's cover, in the screen edition's hebrew.tools colours
// (covers are always printed in colour, whatever the interior).
// Laid out on the full wrap: bleed | back | spine | front | bleed.
#import "gesenius.typ": primary, accent, accent-light, accent-gradient, rule, sans, hebrew-font, coral

#let cover(trim-w: 6in, trim-h: 9in, bleed: 0.125in, spine: 1.5in, back-text: none, guides: false) = {
  let W = 2 * trim-w + spine + 2 * bleed
  let H = trim-h + 2 * bleed
  let safe = 0.375in                      // text stays this far inside the trim
  let back-x = bleed                      // left trim edge of the back cover
  let spine-x = bleed + trim-w
  let front-x = spine-x + spine
  set document(title: "Gesenius' Hebrew Grammar — cover")
  set page(width: W, height: H, margin: 0pt, fill: primary)
  set text(font: sans, fill: white)

  // the rainbow line across the whole wrap, as on the title page
  place(top + left, dy: bleed + 0.55in, block(width: W, height: 5pt, fill: accent-gradient))

  // ── front ──
  place(top + left, dx: front-x + 0.75in, dy: bleed + 1.25in, block(width: trim-w - 1.5in, {
    set par(justify: false, leading: 0.5em)
    text(size: 17pt, weight: "bold", tracking: 0.14em, fill: accent-light)[GESENIUS’]
    v(0.08in)
    text(size: 46pt, weight: "extrabold", tracking: -0.015em)[Hebrew\ Grammar]
    v(0.3in)
    block(width: 1.1in, height: 3pt, fill: accent)
    v(0.35in)
    text(size: 9pt, tracking: 0.08em, fill: white.transparentize(25%))[AS EDITED AND ENLARGED BY]
    v(0.03in)
    text(size: 17pt, weight: "bold")[E. Kautzsch]
    v(0.2in)
    text(size: 9pt, tracking: 0.08em, fill: white.transparentize(25%))[SECOND ENGLISH EDITION BY]
    v(0.03in)
    text(size: 17pt, weight: "bold")[A. E. Cowley]
  }))
  place(top + left, dx: front-x + trim-w - 2.6in, dy: bleed + trim-h - 3.3in,
    text(font: hebrew-font, size: 190pt, fill: white.transparentize(88%), [א]))

  // ── spine (reads top to bottom, as on English-language books) ──
  place(top + left, dx: spine-x, dy: bleed, box(width: spine, height: trim-h,
    align(center + horizon, rotate(90deg, reflow: true, box(width: trim-h - 1in, {
      set par(justify: false)
      grid(columns: (1fr, auto), align: (left + horizon, right + horizon),
        text(size: 15pt, weight: "extrabold")[#text(fill: accent-light, size: 11pt, tracking: 0.12em)[GESENIUS’] Hebrew Grammar],
        text(size: 9pt, tracking: 0.08em, fill: white.transparentize(20%))[KAUTZSCH · COWLEY])
    })))))

  // ── back ──
  place(top + left, dx: back-x + 0.75in, dy: bleed + 1.25in, block(width: trim-w - 1.5in, {
    set par(justify: true, leading: 0.62em, spacing: 0.9em)
    set text(size: 10pt)
    if back-text == none {
      block(width: 100%, inset: 12pt, stroke: (paint: accent-light, thickness: 1pt, dash: "dashed"), radius: 4pt,
        text(fill: accent-light)[*Back-cover text goes here.* Mitch writes it; put it in `tools/print_details.json` as `back_cover` and rebuild the cover.])
    } else { back-text }
  }))
  // barcode area: left empty (white) for the printer's ISBN barcode
  place(top + left, dx: back-x + trim-w - safe - 2in, dy: bleed + trim-h - safe - 1.2in,
    block(width: 2in, height: 1.2in, fill: white))

  if guides {
    let line-at(x) = place(top + left, dx: x, line(start: (0pt, 0pt), end: (0pt, H), stroke: 0.5pt + coral))
    for x in (bleed, spine-x, front-x, W - bleed) { line-at(x) }
    place(top + left, dy: bleed, line(start: (0pt, 0pt), end: (W, 0pt), stroke: 0.5pt + coral))
    place(top + left, dy: H - bleed, line(start: (0pt, 0pt), end: (W, 0pt), stroke: 0.5pt + coral))
    for x0 in (back-x, front-x) {
      place(top + left, dx: x0 + safe, dy: bleed + safe,
        rect(width: trim-w - 2 * safe, height: trim-h - 2 * safe, stroke: (paint: accent, dash: "dotted")))
    }
  }
}
