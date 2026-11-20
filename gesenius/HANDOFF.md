# Gesenius' Hebrew Grammar — modern edition: handoff

This is a multi-session project. **Every session starts by reading this whole
file**, then runs `python3 tools/proof_status.py next` and works that chunk.
All state lives on disk in this folder; nothing depends on any earlier
conversation. Work from this folder (`gesenius/` in the
`gesenius-grammar-modernize-ac64c1` worktree). Each run commits its work
with `tools/proof_commit.py` (Mitch asked for this, 2026-10-16), which also
pushes the branch to the private `backup` remote,
github.com/mitchellpalermo/Genesius-grammar (Mitch asked for this,
2026-10-23). Never push to `origin` (the public bible-language-tools repo —
not public yet) and never open a pull request.

## What Mitch asked for (decisions already made — do not re-ask)

- A modernized PDF of *Gesenius' Hebrew Grammar*, Kautzsch–Cowley 2nd English
  edition (1910). Public domain.
- **All attribution stays exactly as on the 1910 title page** (Gesenius;
  "as edited and enlarged by the late E. Kautzsch, Professor of Theology in the
  University of Halle"; "Second English edition revised in accordance with the
  twenty-eighth German edition (1909) by A. E. Cowley"; "with a facsimile of the
  Siloam inscription by J. Euting, and a table of alphabets by M. Lidzbarski";
  Oxford at the Clarendon Press).
- **Styled like hebrew.tools**: Plus Jakarta Sans + Noto Sans Hebrew, the
  green palette and rainbow accent gradient from
  `apps/hebrew-tools/src/styles/global.css` and `Layout.astro`.
- **6×9 in trade-book page.**
- **A note near the table of contents** saying it was reformatted by an
  artificial intelligence tool, and **beside it a QR code** captioned exactly
  *"If you desire to verify against the original scan here"* linking to
  `https://ia600109.us.archive.org/26/items/geseniushebrewgr00geseuoft/geseniushebrewgr00geseuoft.pdf`.
  (Done: `tools/frontmatter.py`.)
- **Light wording modernization** — rule-based, listed in the edition note,
  reversible: `tools/modernize.py`. Applied at build time, never written into
  the proofread wikitext. Scripture references are rendered in SBL form
  (`1 Sam 15:6` for Gesenius' `1 S 15⁶`). § numbers and paragraph letters are
  never changed. *thou/thee/ye* in glosses are kept (they mark number).
- **Source text: the English Wikisource transcription**, and **every page
  Wikisource has not proofread is proofread here against the scan** (Mitch
  chose this knowing it is slow). Wikisource's paradigm pages are unproofread
  and wrong in places; paradigms are re-transcribed from the scan.
- **The three indexes** (subjects, Hebrew words, passages) are transcribed from
  the scan. Wikisource has only scraps of them.
- Mitch saw the sample (`build/sample.typ`, §22 + Paradigm B) and chose to go
  ahead; keep its look unless he asks for changes.

## Layout of this folder

| Path | What |
|---|---|
| `scan/geseniushebrewgr00geseuoft.pdf` | the scan (gitignored; also at the URL above). PDF page = printed page + 24 |
| `ws/pages.json` | Wikisource `Page:` wikitext for every scan page, with its proofread level (fetched 2026-10-16) |
| `ws/additions.json` | the *Additions and Corrections* subpages the text transcludes |
| `proof/status.tsv` | **the queue** — one row per page: chunk, status (`todo`/`done`/`flagged`/`skip`), notes |
| `proof/pages/<n>.wiki` | **working copy** of each queued page — this is what you correct |
| `proof/corrections.tsv` | every fix applied, page / old / new (written by `proof_fix.py`) |
| `proof/runs.tsv` | one timed row per run (written by `proof_lock.py release`) — `proof_status.py estimate` projects hours left from it |
| `proof/run.lock` | present while a run is working the queue |
| `proof/strips/` | scratch images (gitignored, safe to delete) |
| `tools/convert.py` | wikitext → Typst converter (templates, refs, footnotes, tables) |
| `tools/paradigms.py`, `render_paradigm.py` | verb paradigms as checked data, and their tables |
| `tools/frontmatter.py` | title page, verso, edition note + QR, contents |
| `build/gesenius.typ` | the Typst page design (tokens, margins, headings, margin letters) |
| `build/sample.typ` | the approved sample (§22 + Paradigm B) |
| `fonts/` | Plus Jakarta Sans, Noto Sans, Noto Sans Hebrew (OFL) |

Tools: system `python3` runs the proof tools. The build tools need
`mwparserfromhell` and `qrcode`, which are in `.venv/` here (gitignored; recreate
with `python3 -m venv .venv && .venv/bin/pip install mwparserfromhell qrcode
pillow`). Typst 0.15, poppler and ImageMagick are installed on this Mac.
Rebuild the sample: `.venv/bin/python -I tools/build_sample.py ws build && (cd
build && typst compile --font-path ../fonts sample.typ sample.pdf)`.

## Chunk order

`python3 tools/proof_status.py summary` shows all of them.

1. **B01–B31** — body pages (12 per chunk). Protocol A.
2. **P01–P05** — paradigm spreads. Protocol B. Paradigm B (scan 534–535) is
   already done.
3. **I01–I09** — index pages 557–622. Protocol C.
4. **S1** — build the whole book. Protocol D. Do not start S1 until
   `summary` shows everything else done.

A session takes the next chunk, finishes it, and if it has budget left, takes
the next. Stop between pages, never mid-page: a page is only `done` once its
fixes are saved. Only one run works the queue at a time: `tools/proof_lock.py`
enforces it (a lock older than 2 hours counts as abandoned — longer than any
chunk, shorter than a usage-limit reset). If you stop a run by hand, run
`python3 tools/proof_lock.py abandon` before restarting; the next run resumes
the half-done page (see the skill's "Resume safely").

### Running it on a loop

The project skill `gesenius-proofread` (`.claude/skills/gesenius-proofread/`
at the worktree root) is one run: lock, next chunk, unlock, log. Start a
session in this worktree and run it on a fixed interval:

    /loop 30m /gesenius-proofread

A self-paced `/loop /gesenius-proofread` schedules each run from the end of the
last one, so a run killed by a usage limit ends the loop; a fixed interval
keeps firing and resumes on its own after the reset. The loop stops itself
when only the build (S1) is left; the build is started by hand.

## Protocol A — proofreading a body page

For each `todo` page in the chunk:

1. `python3 tools/proof_page.py <n>` prints
   - the four scan strips to read (`proof/strips/<n>-1..4.png`, 1.4× zoom),
   - an **English diff** against the scan's OCR layer — pointers only,
   - the **Hebrew sheet** (`proof/strips/<n>-heb-*.png`): every Hebrew word on
     the scan page, enlarged ~3.6× and numbered in reading order,
   - the numbered list of Hebrew in the wikitext, then the wikitext itself.
2. Read all four strips and the Hebrew sheet(s). Compare:
   - **English**: missing or extra words, especially an English gloss after a
     Hebrew word, and OCR slips (`and` for `2nd`, `fern` for `fem.`,
     `ioc`/`I.`). Use the diff to find them, the image to decide.
   - **Hebrew**: walk the sheet against the numbered list — consonants first
     (final letters, ה/ח/ת, ב/כ, ד/ר, ו/ז/י), then vowels (tsere vs sheva vs
     segol, qamets vs patah, holem placement), shin/sin dot, dagesh, the
     stress mark ֫. The sheet catches most but not all Hebrew; anything it
     missed, check in the strips, and zoom when unsure:
     `python3 tools/proof_zoom.py <n> <strip>:<x0>,<y0>,<x1>,<y1> …`
     (coordinates in the strip image's pixels; several crops → one image).
   - **References**: Bible chapter/verse numbers and § references/letters.
   - **Italics, footnotes, paragraph letters** (`GHGmargin-letter`) present
     and in the right place.
3. Fix with `python3 tools/proof_fix.py <n> 'old' 'new' ['old' 'new' …]`.
   Each `old` must be unique on the page — include `text=…}}` or neighbouring
   words. It logs to `proof/corrections.tsv`.
4. `python3 tools/proof_status.py done <n> "<short summary of fixes>"`, or
   `flag <n> "<what you could not resolve>"` if something stays uncertain.
   Before `done`, log each close judgment call (faint print, a reading you
   chose between two, Wikisource text deliberately left alone) with
   `python3 tools/proof_review.py add <n> "<question>" "<choice>"`. Mitch
   checks `proof/review.tsv` later and sets each row's status to `ok` or `fix`;
   `proof_review.py list` shows the open ones.

Rules that matter:

- **Broken type is not a reading** (Mitch, 2026-10-16). Where the print is
  plainly damaged — a dropped or broken letter or point, a split word like
  `c curs` or `I will le` — use the word the printer intended, and log the
  case with `proof_review.py`. This covers only obvious mechanical damage;
  an author's or printer's genuine misprint (a wrong verse number, a wrong
  form) stays as printed, per the next rule.
- **The scan is the authority, not grammar.** Do not "correct" a form to what
  you expect. If print and expectation disagree and the print is legible, the
  print wins. If the print is illegible, leave Wikisource's reading and `flag`.
- **Hebrew lists keep Wikisource's convention**: in a run like
  `{{GHGheb|text=A}}, {{GHGheb|text=B}}` the items are in left-to-right
  *visual* order as printed, and the renderer isolates each item so it prints
  that way. A multi-word phrase inside one `GHGheb` is in normal logical order.
- **ʾ is alef, ʿ is ayin** in transliterations; check which one is printed.
- **Never modernize while proofreading.** The wikitext stays a faithful copy;
  modernization happens in `modernize.py` at build.
- Keep Wikisource's markup (templates, `<ref>`, `<section>` tags). Don't
  reflow or reformat lines — make the smallest exact replacement.
- Wikisource sometimes encodes a printed `ψ` as `book=Ps`: that is fine.

Pilot measurements (page 230): about 10 fixes on an unproofread page — mostly
Hebrew vowel/letter slips plus OCR `and`→`2nd`. Expect a handful per page.

## Protocol B — paradigm spreads (P01–P05)

Paradigms are rebuilt as data in `tools/paradigms.py` (see `PARADIGM_B` and
its docstring for the cell format: forms in printed left-to-right order, `*`
marks a model form, `—` empty, `~text` for English like `~wanting.`,
`|4` rowspan). For each spread:

1. Start from the Wikisource wikitext in `proof/pages/<n>.wiki` as a draft,
   but expect wrong letters and shifted cells (its rows often have extra empty
   cells).
2. Render the scan at 300 dpi and read it in horizontal strips at ~1.6× zoom;
   zoom single cells with `proof_zoom.py` (after `proof_page.py <n>` has made
   the strips) whenever a vowel is uncertain.
3. Write the paradigm as a new `PARADIGM_<X>` entry. A, C and Q have different
   shapes from B (pronoun suffix tables, verbs with suffixes) — extend
   `render_paradigm.py` for them rather than forcing B's shape.
4. List every departure from Wikisource in the entry's docstring, as B does.
5. Mark the spread's pages done.

## Protocol C — the indexes (I01–I09)

Scan pages 557–622: Index of Subjects, Index of Hebrew Words, Index of
Passages, each in two columns. Wikisource has raw OCR for a few pages (with
`{{hebrew missing}}`) and nothing for most.

Transcribe each scan page into `proof/pages/<n>.wiki` (create it if missing),
reading the page column by column, in the same wikitext conventions as the
body so the converter handles it:

- one entry per line; sub-entries continue the line as printed (`Article, 35:
  syntax of, 126: with demonstrative force, 126 ''a'', ''b'': …`);
- section letters in italics `''a''`, `N.` for "note";
- Hebrew in `{{GHGheb|text=…}}` — in the Hebrew-word index, the headword;
- Index of Passages: one row per verse, `2 | 141 ''c''`; the chapter number in
  bold at its first verse (`'''1''' 1 | 5 ''n'', …`); each book named once as a
  `== Genesis ==` heading where it begins (no running heads at column tops);
  dot leaders dropped. **Mitch approved this format on 2026-10-24**; S1 styles
  it as is.
- start the page with `<!-- scan <n>, printed <n-24>, <which index> -->`.

These references are to **sections**, so they stay valid in the new layout.

## Protocol D — the build (S1)

Not yet written; `build/sample.typ` + `tools/build_sample.py` are the
pattern. What S1 must do:

- `tools/build_book.py`: assemble scan pages 25–531 in order from
  `proof/pages/<n>.wiki` where it exists, else `ws/pages.json`; convert with
  `convert.py`; insert paradigms (`paradigms.py`) and indexes; write
  `build/book.typ`; compile with `typst compile --font-path fonts`.
- **Structure**: Parts and Chapters are free-form centred blocks in the
  wikitext (see the Contents, scan pages 15–20). Map them to `=` / `==`
  headings by § number (Introduction before §1; First Part + Ch. I at §5;
  Ch. II at §18; Second Part at §30; Ch. I The Pronoun §32; Ch. II The Verb
  §38; Ch. III The Noun §79; Ch. IV The Particles §99; Third Part Syntax at
  §106; Ch. II The Sentence §140; and the sub-heads inside chapters), and
  drop the original blocks.
- Front matter: Translator's Preface, From the German Preface, List of
  Abbreviations (add a line that Scripture references now follow SBL style),
  the Siloam inscription (scan pages 22–23: keep the facsimile as an image
  cropped from the scan) and the Table of Early Semitic Alphabets (locate it
  in the scan; image). *Additions and Corrections* are already applied inline
  by Wikisource (`GHGcorrected`); say so in the edition note rather than
  reprinting the list.
- Edition note (`frontmatter.py`): update "Sources" with the real numbers —
  pages proofread here, number of corrections (`wc -l proof/corrections.tsv`),
  and that paradigms and indexes were transcribed from the scan.
- Known converter gaps to handle: a footnote inside a § heading (render it,
  keep it out of the outline/bookmarks); `{{raw image}}`; `colbegin/colend`
  (two-column index); `GHGhebT` blocks; tables in §§93/95 (noun paradigms,
  inline in the body); converter `warnings` — print and clear them all.
- QA: read every warning; spot-check ~20 pages across the book as images
  against the scan; check the outline/bookmarks; check that § cross-reference
  links resolve.
- Deliver the PDF to Mitch (SendUserFile) and say plainly what was and was not
  verified.

## Log

Append one line per run: the summary `proof_lock.py release` prints (start →
end, minutes, chunks, pages, fixes, min/page), then anything the next run must
know. The numbers come from `proof/runs.tsv`; don't type them by hand.

- 2026-10-16 — set up the pipeline, sample approved, page 230 proofread as the
  pilot (10 fixes), Paradigm B verified. Next: B01.
- 2026-10-16 — B01: 2026-10-16T14:06:52 → 15:21:53, 75.0 min, 11 pages (1 flagged),
  40 fixes, 6.8 min/page (page 33 was done by an earlier run of this session
  that was interrupted and recorded `abandoned`; the 75 min includes a
  usage-limit pause, so the true pace is faster). Flagged 66: the Babylonian
  vowel-mark footnote is placeholders and the print has two signs the wiki
  omits; it needs images cropped from scan 67 at build time. Recurring in this
  stretch: wrong Hebrew letter in a word (ד/ר, ח/ה, ג/נ, final ם for medial מ),
  missing or extra punctuation around ed. Mant./Baer variant readings, and
  English OCR slips (fortz, peps, hems, fall for full). Next: B02.
- 2026-10-16 — B02: 2026-10-16T15:41:04 → 15:47:29, 6.4 min, 12 pages (0 flagged),
  43 fixes, 0.5 min/page. The B01 figure includes a usage-limit pause, so the
  two runs bracket the real pace; trust `estimate` only after a few more rows.
  This stretch (§§ 27–30) has the same Hebrew-letter slips as B01 (ד/ר twice:
  בִּֽיהוּדָה again, חרק, ספרד; ה/ח: חָיָה, וֶֽחְיֵה) plus split § letters
  written as `{{GHGpar|72|d}}d` — grep for `}}[a-z]\b` after a GHGpar on later
  pages. The print's ס and ם are indistinguishable in unpointed roots; keep
  Wikisource's reading there. Next: B03.
- 2026-10-16 — B03: 2026-10-16T16:11:06 → 16:15:42, 4.6 min, 12 pages (0 flagged),
  21 fixes, 0.4 min/page. §§ 30–39 (pronouns, article, start of the verb) is
  cleaner than §§ 20–29: three pages had no fixes. Patterns here: transliterated
  alef typed as ’ instead of ʾ (seven on page 130 alone — grep `''’` per page),
  a book name misattached to a verse ref (`on Lev {{…book=Dt…}}`), and stray
  dagesh in paradigm forms (הָקְּטַל). Page 131's חִיא for הוּא is a genuine
  misprint in the 1910 text; kept as printed. Next: B04.
- 2026-10-16 — B04: 2026-10-16T16:41:07 → 16:46:10, 5.0 min, 12 pages (0 flagged),
  24 fixes, 0.4 min/page. §§ 40–48 (flexion of Perfect, Infinitive, Imperative,
  Imperfect). Most fixes are stray or wrong points in paradigm forms
  (יִקְטִֹל, תִָּקְטֹ֫לְנָה, לְבַשֹׁ, חֳָרָ֑בִי — grep for two vowels on one letter),
  one wrong consonant per page or so (לָמַר, שְׂמַה), and a garbled pair of
  Hebrew words with the semicolon inside one GHGheb (page 150). Pages 145, 147,
  153 needed nothing. Next: B05.
- 2026-10-16 — B05 partial (usage limit): pages 154–160 done, 161–165 still todo.
  Fixes: OCR `and`→`2nd` twice (pages 155, 156 — grep `the and`), doubled
  vowels, Ex/Ez book mix-up. The run row above in runs.tsv covers only these
  seven pages. Next: finish B05 from page 161.
- 2026-10-16 — B05 finished: pages 161–165 done, 0 flagged, 10 fixes. OCR word
  slips (emission→omission, gone→tone, "put out on"), Greek ξ→χ in μάχεσθαι,
  vowel slips (Piʿ̄l→Piʿēl, Puʿal ŏ→ă), נְלְחַם→נִלְחַם. Next: B06.
- 2026-10-16 — B06 done: pages 166–176, 180; 0 flagged, 36 fixes. Look-alike
  letters (ט/מ in יַקְטִיל etc. on 172, ט/מ in מְלוֹשְׁנִי 175, ה/ח in חסר 169, ג/נ
  in הִתְגַּדֵּל 174), stray/doubled points (וָאֲצַוֶּה, הִתְגֹּעֲשׁוּ, זֹרְמוּ), ’→ʾ,
  mojibake "aŒ¬"→ā̆ (180 fn), wrong book in a ref (Is→Jb 13:27, p.174), one
  section end tag par54→par55 (176). Next: B07.
- 2026-10-16 — B07 done: pages 181–185, 194–196, 200–204; 0 flagged, 28 fixes.
  ר/ו (וַיְבָרֶךְ 194), dropped/stray points (קְטָלַתְהָ 184, מְשַׁלֵּחֲךָ,
  וַתֵּעָצַר, וַיָּסָב), missing final ם (וְישַׁעֲכֶם 196), English slips
  (more→mere, from→form, soon→seen, yă→hă-sēb), book=Job→Jb template refs (204),
  a Stade § wrongly linked as GHGpar (200, unlinked). Next: B08.
- 2026-10-16 — B08 done: pages 205–207, 209–217; 0 flagged, 40 fixes. Look-alikes
  (ו/ז תֵּזְלִי 210, ר/ו יִירַשׁ 212, ת/ה הָבָה 214, ה/ח וַיּוֹכַח 215), stray/missing
  points (ׄ upper dot → holem, יְבֹשׁ/יְבֹשֶׁת on 213, 216), reversed RTL pairs
  "X ;Y" (207, 211), English OCR (east→cast, arrears→appears, soon-style slips),
  a Ju-for-Is ref with stray "is" (205). Unresolved but left (print faint):
  2 S 14 verse on p.217 (wiki 19, print looks like 13). Next: B09.
- 2026-10-16 — B09 done: pages 218–229; 0 flagged, 52 fixes. Heavy ד/ר and ג/נ
  confusion in §72–73 (תְּרוֹמֵם גּוֹי, וַיֵּרֹמּוּ, הֵרֹמּוּ, מוּר, רִיב יָרִיב, הרים,
  בֹּרַאֲךָ), ב/כ in suffix כֶם (196-style, again 229), missing dagesh in וַיָּ forms
  (224, 226, 228), OCR English (mast/mase/muse→masc, band→hand, censonantal),
  two Stade § refs mislinked as GHGpar (219), extra Est 4:14 ref not in print
  removed (224), duplicate section-begin tag removed (226). Next: B10.
- 2026-10-16 — Added the review log (`tools/proof_review.py`, `proof/review.tsv`)
  for close judgment calls, at Mitch's request; backfilled 6 calls from B07–B10.
  `proof_fix.py` now refuses no-op fixes and escapes line breaks/tabs when
  logging, and four rows of corrections.tsv that a multi-line fix had split
  across lines (pages 99, 108, 202, 235) were rejoined. B05–B09 were never
  committed at the time (the per-run commit step was missed); committed now in
  one catch-up commit, with B10 pages 231–235 included as work in progress.
- 2026-10-16 — B10 done: pages 231–241 (§74 l–§76 d); 0 flagged. Lock timer
  spans the review-log interruption, so its minutes overstate the run. Fixes:
  ד/ר and נ/ו slips (כָּרֹת, רְאוֹת, נַאֲוָה, הֶחְבְּאַתָה), §-letter margin markers
  on 241 moved to the print's positions (76 b at "2.", c at (b), d at (c)),
  Stade/Barth § refs unlinked (234), ’/‛→ʾ/ʿ. 5 review items logged (236, 237,
  239, 240, plus backfill). Open policy question in review.tsv: broken type
  ('c curs' p.234 kept vs 'I will le' p.239 left as 'be'). Next: B11.
- 2026-10-16 — Broken-type rule added (see Protocol A): obvious mechanical
  damage → intended word + review log. Applied to p.234 ('c curs'→'occurs').
- 2026-10-16 — B11 done: pages 242–244, 259–267 (§76 e–§78, §84b o–§87 p); 0 flagged,
  52 fixes, 5.2 min. Same look-alike pattern (ח/ת תְּהִלִּים, ג/נ אִגְּרוֹת, ח/ת
  חָזוֹן, ז/ו מִזְבֵּחַ, ח/ה חָכְמוֹת), English OCR (heating→healing, musc→masc,
  ground-from), ‛/’→ʿ/ʾ throughout, a broken {{GHGcite|title|…}} template (262),
  Barth/Stade § refs unlinked (264). 4 review items (242, 243 ×2, 266). The new
  no-op guard in proof_fix.py fired once and wrote nothing, as intended. Next: B12.
- 2026-10-16 — B12 done: pages 268–279 (§87 p–§91 e); 0 flagged, 38 fixes, 4.8 min.
  Look-alikes (ה/ח חֲלוֹם, ם/ס כִּסֵּא, פ/מ הַמֶּלֶךְ, נ/כ suffix table כֶם, ח/ת
  בְּתוֹכְכֶם), garbled pointing (נַהֲרַיִם, גְּנֻבְתִי … לָיְלָה, דַּיֶּךָּ, the
  suffix table on 278), musc→masc again, ‛/’→ʿ/ʾ. 2 review items (272, 275).
  Next: B13.
- 2026-10-17 — B13 done: pages 280–285, 288–289, 301–304 (§91 e–§95 q). The first
  run stalled overnight after page 282 and was recorded `abandoned`; the resume
  run did 283–304 (3.8 min). 0 flagged, 48 fixes total. Paradigm tables (288–289,
  301–302) carry many one-letter slips (ד/ר צְדָקָה, ה/ח חֶרְפָּה חֻקּוֹת, ט/מ זִמָּה,
  נ/ג גְּבִרְתְּכֶם, ס/ם מַלְכַּת) and an "eorum" for "earum" in the 283 table.
  0 review items. Several queued loop firings arrived while the run was stalled;
  they were folded into this one run. Next: B14.
- 2026-10-17 — B14 done: pages 306–308, 311–315, 317–320 (§96–§100 o, end of the
  numerals and start of the particles). 0 flagged, 32 fixes. Recurring issue: Wikisource sometimes stored
  two-word Hebrew in visual left-to-right order (עָשָׂר<ref> עַשְׁתֵּי on 314,
  רִבּוֹא שְׁתֵּי on 315); restored logical order and logged both. Also letter
  swaps אָמתַ֫יִם→מָאתַ֫יִם, אָו→אָז, מִוֶּה→מִזֶּה, and non-Gesenius § refs (Barth,
  Stade) unlinked. Review items: 311 (§97 holem policy), 314 ×2 (row order; Ex
  45¹² misprint for Ez kept), 315. Next: B15.
- 2026-10-17 — B15 done: pages 321–332 (§100 o–§105 b, end of the particles).
  0 flagged. The visual-order problem from B14 recurred in fused spans: אֱלַי
  (אֲלַי) on 328 and the Gn 7:13 / 1 K 21:10 run on 331 (rebuilt). Also ב/כ
  swaps in כָּכֶם (327), ט/מ and dagesh slips in the מִן table (מִמְּךָ, מִמֵּךְ),
  ה/ח (בֵּינֵיהֶם, אֲלֵהֶן, וָפָח), and Wikisource had silently corrected the
  printed "2 K 22³⁰" to 1 K (330) — restored as printed. Review items: 321, 325,
  328, 330, 331. Eight queued loop firings arrived during the run and were folded
  into it. Next: B16.
- 2026-10-17 — B16 done: pages 333–346 (§106–§109 f, start of Syntax: the
  perfect, imperfect, cohortative and jussive). 0 flagged, 35 fixes. Mostly
  ד/ר (יִסָּפֵר, אֲשֶׁר twice on 343, וְהַנַּעַר), ב/כ and ב/נ (כַּאֲשֶׁר 335,
  יַנְחֵנִי 339, הָטְבָּעוּ 338), פ/מ (שָׁמָּה 346), wrong book names in refs (Gn→Is
  63, Ps→Is 40), a dropped 1 K 7:8, a mislabelled "(b)" for "(a)" on 345, and
  many unitalicized cross-reference letters. Review item: 342 (Ez 12:12 word
  order). Next: B17.
- 2026-10-17 — B17 done: pages 347–355, 357–359 (§109 g–§112 dd: jussive,
  imperative, imperfect and perfect with wāw consecutive). 0 flagged, 46 fixes.
  Hebrew: ה/ח (יְחַיּוּ, וַתִּירְאִי, וְהֶחֱרַשְׁתִּי, וְהָיוּ), ת/ה (ויהי ×2), נ/ג
  (וְגָדַעְתִּי), נ/ו (וִיכַזֵּב), stray dagesh (מֵאָז). Wrong § numbers in
  cross-refs (§ 144 r→114 r, § 112 c→111 c), a missing "(" on 359, and many
  unitalicized section letters. Visual-order spans again on 349 and 352. Review
  items: 347 (Jb 37:22 vs 27:22), 349, 350 (Dn 15¹⁹ misprint kept), 352.
  Next: B18.
- 2026-10-17 — B18 done: pages 360–371 (§112 ee–§114 e: end of the perfect
  consecutive, the infinitive absolute, start of the infinitive construct).
  0 flagged, 47 fixes. Hebrew: וְהֹשִׁיבוּ (missing holem), וְנָשָׂא, חֲבֹל (ה→ח),
  stray vowels in וַיֹּאמֶר, וְהֶעֱמִיד, וְאָבֹא, הַשְׁכֵּם, אָדוֹשׁ/אָסוֹף.
  Visual-order runs again on 361 (Gn 44:29, 1 S 2:15). English: "hooks"→"books",
  "Ausgeäwhlte", "verbal-nominals", "surety"→"surely"; Barth § ref unlinked;
  many unitalicized section letters. Review items: 361, 363 (Ez 8:36 restored
  as printed). Next: B19.
- 2026-10-17 — B19 done: pages 372–378, 380–384 (§114 e–§116 t: infinitive
  construct, its subject and object, and the participles). 0 flagged, 47 fixes.
  Hebrew: the participle עֹשֶׂה family was mangled throughout 381–382 (holem and
  sin-dot merged into ש, e.g. עשֹׁוֹ, עשֵֹׁה); הָקִים (ס→ם), כָּל (ב→כ), הֵיטִיב (מ→ט),
  עֹרֵר (י→ר), לִבּוֹ, stray ׄ marks on נֹפֵל, נֹבֶלֶת, יֹצְאֵי, וְנֹכַחַת. A "##"
  join on 373. English: "heat thee"→"heal thee", "ninny"→"many", joined words.
  Review item: 382 (Ez 27:34 visual order). Next: B20.
- 2026-10-17 — B20 done: pages 385–396 (§116 u–§118 b: end of the participle,
  the accusative of the object, double accusative). 0 flagged, 51 fixes.
  Hebrew: ה/ח (זֶבַח, אֶחָד, שָׁטַח, הֶחֱיָה, מָשַׁח, לֶחִי), the עֹשֶׂה holem/sin-dot
  merge again (392), stray marks (יָצָא, שִׂפְתֵי, בִּשַּׂר, מִזְבַּח). Visual-order
  spans again on 385, 389, 393, 395. Many {{GHGbible-ref|translate=…}} misuses
  (the translate param swallowed the following English) unwound into plain
  italics. Review items: 385, 389, 391 (1 K 1¹² cited twice), 393, 395. Five
  queued loop firings arrived during a ~2.5h pause and were folded in. Next: B21.
- 2026-10-17 — B21 done: pages 397–408 (§118 b–§119 ii: the looser accusative
  and the prepositions אֶל, בְּ, לְ, מִן, עַל). 0 flagged, 44 fixes. Hebrew: ד/ר
  (עִבְרוּ, בְּרַח, הִשָּׁמֶר, דָּרַשׁ), ת/ה (תָּמַהּ, בָּנָה), ח/ת (שמח), כְּיוֹם for
  בְּיוֹם, missing holems (מֹשֵׁל) and vowels (כַּחֲלוֹם, מֵרְאֹת). Several more
  {{GHGheb|translate=…}} misuses where a Latin term (essentiae, instrumenti,
  indole) had been swallowed into the gloss. Visual-order spans again on 397,
  402. Review items: 397, 402. Next: B22.
- 2026-10-17 — B22 done: pages 409–420 (§120–§124 a: complementary verbal ideas,
  passives, gender of nouns, collectives and repetition). 0 flagged, 56 fixes.
  Hebrew: ד/ר (וַיַּחְפֹּר, רָשׁ), ה/ח (וַיִּוָּלֵד, צִוָּה, יָלְדָה), ת/ה (קוּמָה, הָרִים
  צִלָּהּ), ע/צ (חָצֵר), missing dagesh/vowels (אַיָּל, יוֹנָה, חֲסִידָה, נְמָלָה,
  מַהֵר, יֹשֵׁב, יַגְדִּיל, אֲדָמָה, רֵיקִים). A missing {{GHGmargin-letter|122|u}}
  added; "II." restored in the Syntax of the Noun heading; Ju 19:6 recovered
  from broken type "Ju 1 ⁶". English: "smite thom", "string ones". Review
  item: 410. Next: B23.
- 2026-10-17 — B23 done: pages 423–434 (§124 g–§127 b: plurals of majesty and
  result, determination of proper names, the article). 0 flagged, 42 fixes.
  Hebrew: the עֹשֶׂה holem/sin-dot merge again (עֹשָׂי, עֹשַׂיִךְ, עֹשָׂיו, עֹשֶׂיהָ),
  missing holems (קְדֹשִׁים, שְׁלֹמֹה, גֻּלֹּת), ה/ח (הָאִישׁ הַזֶּה, הַדְּבָרִים, הָרִים
  ×2, הַבַּיִת), ב/כ (כֶּסֶף, כַּגִּבּוֹר), ו/ז (זָּהָב, הַזֶּה), ב/נ (וְהַנּוֹרָא), ר/ד
  (קָדוֹשׁ), שׂ/שׁ (שָׂדַי). Wrong ref Ex 3:14 → 31:4 (print 31⁴). Review item:
  426 (הַמְנַשֶּׁח printed with ח). Seven queued loop firings arrived during a
  ~3h pause and were folded in. Next: B24.
- 2026-10-17 — B24 done: pages 435–446 (§127 b–§130 f: determination by genitive,
  the construct state and its circumlocutions). 0 flagged, 44 fixes. Hebrew:
  ב/כ (הַבֵּן, בַּמָּקוֹם, בְּעָפְרָה, כִּסְאֲךָ, כָּל־הַכֵּלִים, כַפַּיִם), ר/ד (הָאָדָם ×2,
  הַנַּעַר), ת/ח (הַחֲנִית, הַיְתַד, הַיָּתֵד, הָרַקָּחִים, חָלָב, מַחֲמַדֵּי), ח/ה
  (הַשְּׁלִישִׁי), מ/ט (הַטּוֹב), ס/ם (הַנְּבִיאִים, הַכֵּלִים), שׂ/שׁ (שָׁנָה). Wrong ref
  1 K 15:2 → 1:52; Job/Lev book codes normalized. English: "hats me", "coustruct",
  "Accontuation". Review item: 446 (Ex 4:13 shewa under תּ). Next: B25.
- 2026-10-17 — B25 done: pages 447–458 (§130 g–§134 l: apposition, adjectives,
  comparison, start of the numerals). 0 flagged, 49 fixes. Hebrew: ח/ה (כֹּהֵן,
  נְחֹשֶׁת, לָקַח, הַחֵמָה, הֵיכָל, יהוה), ר/ד (עַיִר), ט/מ (מִדְּבַשׁ, מֵאָה), shin/sin
  dots (נָשָׁיו, שָׁנָה), stray dagesh (רַב, מִן), חַיִּים, קֳּדָשִׁים. Wrong refs
  2 K 2:21 → 22:1, "Jan 3:5" → Jon 3:5, Jb 15<sup>l0</sup> relinked. English: "the
  anther", "eases". Review items: 448 (1 Ch 15:19 visual order), 457 (Ju 11:33
  broken type). Next: B26.
- 2026-10-17 — B26 done: pages 459–470 (§134 p – §138 g). 0 flagged, 33 fixes. Notable: נַּֽעֲמַ֫יִם→פַּֽעֲמַ֫יִם, הַכֶּ֫כֶף→הַכֶּ֫סֶף, גַּס→גַּם, broken אָֽנׄכֹי→אָֽנֹכִי, יָהוָֹה→יְהוָֹה, §137 heading restored to singular "Pronoun", "eases"→"cases" ×2, section-letter italics throughout. Review items: p.460 Gn 31⁷·¹⁴ kept as printed; p.465 "Ezr 11⁵" kept; p.467 "1 S 7²⁸" kept + §137 heading; p.468 Arabic ʾaṯar/ʾallaḏi; p.469 Gn 13:3 reordered. Next: B27.
- 2026-10-17 — B27 done: pages 471–482 (§138 g – §143 e). 0 flagged, 35 fixes. Notable: Zc 7:10 quotation reordered and ה→ח restored; יֹשֵׁב (holem missing ×3), חַסְדּוֹ (ם→ס), כֹּל (ב→כ), יְהוָֹה, בְּקִרְבָּהּ, לְעֵינַ֫יִם; "I. The Sentence in General." heading restored; (α) for mis-transcribed (''a'') ×2; section-letter italics throughout. Run time inflated by a long pause (real pace ~0.4 min/page). Review items: p.471 Ps 78:54 חַר זֶה kept; p.472 Zc 7:10 reorder; p.474 heading; p.482 לְ־לְ Latin + dropped en=, הֶֽעֱבִיד broken holem. Next: B28.
- 2026-10-17 — B28 done: pages 483–494 (§144 a – §147 d). 0 flagged, 42 fixes. Notable: "beth"→"both", "mass."→"masc.", וַיִּקְרָא (doubled waw), חַתִּים (ה→ח), אַף־רוּחִי, בָּטָ֑ח (Jb 6:20), broken-holem fixes (תִּבְגֹּד, נֹגְשָׂיו); Ps 3:5 and Ex 1:20 Hebrew reordered; Latin moved out of translate= (בְּ instrumentale); קָרָא gloss italics untangled; 'inna → ʾinna ×3; section-letter italics and verse-part superscripts throughout. Review items: p.484 קָרָא gloss; p.485 Ps 3:5 reorder; p.487 Ex 1:20 reorder; p.490 בָּטָ֑ח; p.493 Gn 20⁸ kept; p.494 § 159 dd restored. Next: B29.
- 2026-10-17 — B29 done: pages 495–506 (§147 d – §152 w). 0 flagged, 48 fixes. Notable: OCR words "road"/"verso"/"more"/"negationd"/"maybe" → read/verse/mere/negation/may be; letter swaps בָּל/בֹּל→כָּל/כֹּל, בִּי→כִּי, ךְּ→כְּ, הַוֶּה→הַזֶּה, צֶ֫דֶק (ע→צ), בְּקִרְבְּכֶם; broken-holem fixes (וְיִסְגֹּר, בְּנֹתַי, נֹתֵן, הֲיֹרֶ֫דֶת, בֹּ֫קֶר); 1 K 22:15 <ref> moved out of the GHGheb text; bare refs (I S 2:27, Jer 22<sub>6</sub>, Gn 18<sub>9</sub>, Zn 2:1) templated; section-letter italics throughout. Review items: p.495 מַה־זֹּאת broken type; p.496 Ju 5:8 אִם־יֵרָאֶה; p.498 <ref> moved. Next: B30.
- 2026-10-17 — B30 done: pages 507–518 (§152 x – §159 l). 0 flagged, 55 fixes. Notable: letter swaps יִלְקֹט֑וּן (ם→ט), לָהֶם (ת→ה), וַיְדַבְּרוּ (ר→ד), וְעָזַב (ו→ז), אַשְׁרֵי, עָשָׂה; broken/missing points (רָאוּ, יֹשֵׁב, יֹסֵד, חֹ֫שֶׁךְ, מִיָּם, בְּמֶלְקָחַ֫יִם, תִּמּוֹט, אֶהְיֶה, אֲשֶׁר, יַ֫עַן ×2); "forasmuch"; וְ—וְ / גַּם—גַּם dashes restored; Latin "?" out of translate=; bare Jb 3³ᵃ/³ᵇ and Dt 32¹⁷ᵇ templated; section-letter italics throughout. Review items: p.508 "Ze 9⁹" kept; p.514 אָֽרְצָה (אֶ֫רֶץ) reordered; p.517 Ps 104:28 phrase rejoined/reordered. Next: B31 (last body chunk).
- 2026-10-18 — B31 done: pages 519–526, 528 (§159 l – §166 a); last body chunk. 0 flagged, 33 fixes. Notable: letter swaps נִֽחְיֶה (ה→נ), יִפְקְדֵ֫נִי (ר→ד), נִמְשַׁל (ט→מ), וְאָֽמַרְתָּ (ט→מ), עַד (ר→ד), כִּי אָז (stray qamets); broken holem זֹבֵחַ, וְלֹא; שֶׁ· restored; 1 S 2:13 reordered; correlative pairs (כְּ—וּכְ, כְּ—כֵּן, אִם—וְאִם, גַּם—וְגַם) set in reading order; italics in Dt 22 gloss split per scan; section-letter italics throughout. Review items: p.523 + p.524 correlative-pair ordering; p.525 1 S 2:13 reorder. Next: P01 (paradigms).
- 2026-10-18 — P01 done: Paradigms A (scan 532–533, Personal Pronoun) and C (536–537, Strong Verb with Suffixes). 0 flagged; corrections are in the PARADIGM_A / PARADIGM_C docstrings in tools/paradigms.py (proof_fix.py not used, so the run shows 0 fixes). A is a wikitext-cell table (new `tables` key, rendered by the body converter via render_paradigm.wikitext_paradigm); C reuses B's grid with new per-half `caption`/`note` keys and "~—" for printed dashes. Test renders compile. For S1: (1) the bidi order of several Hebrew runs inside one table cell comes out reversed in Paradigm A (separators ; and , between GHGheb runs) — check body tables too; (2) the person/gender label column wraps in C. Run time includes a long pause. Review items: p.532 ×2, p.536 ×2. Next: P02 (scan 538–541).
- 2026-10-18 — P02 done: Paradigms D (scan 538, primae gutturalis), E (539, mediae gutturalis), F (540–541, tertiae gutturalis). 0 flagged; ~30 corrections listed in the paradigms.py docstring. Recurring Wikisource errors on these pages: ה typed for final ח (F, ×6), stray dagesh, wrong row labels. Renderer now takes `|c2` (colspan, D's Qal) and single-page paradigms (no `right`). Review items: p.538 (meteg policy), p.539 (Hithpaʿēl bracket). Next: P03 (scan 542–545).
- 2026-10-18 — P03 done: Paradigms G (scan 542–543, mediae geminatae), H (544, פ״ן), I (545, פ״א). 0 flagged; corrections in the paradigms.py docstring (letter errors ס→ם, נ→ב, ח→ה; missing dagesh/holem; several asterisks added or removed). Renderer: span spec now `|c2r8` (colspan+rowspan; covered cells as None per column in later rows only), and a row whose cells are a single "~text" string becomes a full-width note row (I's "Like Verbs primae gutturalis."). Parenthetical extras printed inside tables go to the half's `note`. Review items: p.542, p.543 (multi-row brackets), p.544. Next: P04 (scan 546–549).
- 2026-10-18 — P04 done: Paradigms K (scan 546–547, פ״י for פ״ו), L (547, verbs properly פ״י), M (548–549, ע״וּ), N (549, ע״י). 0 flagged; corrections in the paradigms.py docstring (פ→ק, נ→ו, ת→ה final, broken stress marks, missing holem). New helpers in paradigms.py: `_lab(kind)` builds the standard verb row labels and `_zip` pairs them with cell lists, so a new verb half is just its form grid. Review items: p.547, p.548, p.549. Next: P05 (scan 550–555).
- 2026-10-18 — P05 done: Paradigms O (scan 550–551, ל״א), P (552–553, ל״ה), Q (554–555, ל״ה with suffixes). All paradigms A–Q now in tools/paradigms.py. 0 flagged; corrections in the docstring (פ→מ, ה→ת, נ→א, missing/stray dagesh, Wikisource's spurious Hophʿal column in P, Q's right-page rows realigned). `_lab` takes kind "jsuff" (Shortened + Suff, no Wāw consec. row). Q is a wikitext table like A. For S1: in wikitext paradigm tables, labels starting "2." / "1." get split by the converter's numbered-paragraph handling (convert.to_typst escapes `^\d+\.` only at paragraph start). Review items: p.550, 551, 554, 555. Next: I01 (indexes, Protocol C).
- 2026-10-18 — I01 done: Index of Subjects, scan 557–565 (A-sounds … Sonants), transcribed fresh into proof/pages/*.wiki (Wikisource drafts for 557/558/560–564 were partial or raw OCR; old copies kept only in the session scratchpad). One entry per line inside {{colbegin}}/{{colend}}; N. for note; Hebrew in GHGheb. Method that works: crop each column into thirds at 300 dpi and use pdftotext's per-column OCR as a typing aid. Footnote on 560 kept as <ref>. Review items: p.558 (index Hebrew pointing), p.559 ×2 (Emphasis 114 vs 113; Dageš lene pairs), p.561. Next: I02 (scan 566–573).
- 2026-10-23 — I02 done: scan 566–573 (end of Index of Subjects; Index of Hebrew Words א–ה). 0 flagged. 568–569 were Wikisource-validated (q≥3) and were proofread in place (6 fixes); the rest were transcribed fresh. The run sat paused 5 days for Mitch's backup decision, so its runs.tsv row is marked `paused` and excluded from the estimate. New: `tools/proof_cols.py <page> [ncol]` makes the column crops for index pages (3 columns for the Hebrew-word index, 2 elsewhere). The scan's page edges clip the outer column on several Hebrew-index pages: reconstruct the lost line-ends and log them. From now on each commit also pushes to the private `backup` remote. Review items: 566, 568, 570 ×2, 571, 572, 573. Next: I03 (scan 574–581).
- 2026-10-23 — I03 done: Index of Hebrew Words, scan 574–581 (ו … מ). 6.1 min, 8 pages, 0 flagged. All transcribed fresh (581's Wikisource draft was a 6-line fragment). Every page has one review item listing its uncertain small-type pointings and any line-ends clipped at the scan's page edge. Next: I04 (scan 582–589; 586–588 have Wikisource drafts, 588 at q=3).
- 2026-10-24 — I04 done: scan 582–589 (Index of Hebrew Words מ … ת; Index of Passages begins, Gn 1:1–8:3). 17.0 min, 8 pages, 0 flagged, 5 fixes (all on 588, the one Wikisource-validated page, proofread in place; the rest transcribed fresh — 586/587 drafts were raw OCR). `tools/proof_cols.py` now renders at the scan's native 400 dpi and takes a third argument, parts per column: use `proof_cols.py <page> 3 6` on the Hebrew-word index (small pointing blurs at 3 parts) and `3 4` on the Passages index, which is also **3 columns**, not 2. Passages format set on 589: `== Genesis ==` once, `'''1''' 1 | 5 ''n'', …` at a chapter's first verse, `2 | …` after; dot leaders and the running book heads at column tops dropped. The scan clips outer line-ends on most pages; 586→587 has an entry (שׁוֹב) split across the page with a word lost in the gutter. Review items: one per page. Next: I05 (scan 590–).
- 2026-10-24 — I05 done: Index of Passages, scan 590–597 (Gn 8:4 – Dt 33:2). 5.7 min, 8 pages, 0 flagged, 0 fixes (all transcribed fresh; Wikisource had only a fragment of 590). Use `proof_cols.py <page> 3 4 70` on most Passages pages: the fourth argument (new) shifts the column grid right when the trim keeps the gutter shadow — without it the section letters at the right of each column are cut off. Book headings appear once, where the book starts (Exodus on 593, Leviticus 595, Numbers and Deuteronomy 596); a page that continues a book has none. Notes with a number print 'N²' → `N<sup>2</sup>`. Column 3 chapter numbers can sit in the gutter shadow (596): reconstruct from the sequence and log it. Next: I06 (scan 598–).
- 2026-10-24 — I06 done: Index of Passages, scan 598–605 (Dt 33:3 – Is 10:15: Joshua, Judges, 1–2 Samuel, 1–2 Kings, start of Isaiah). 4.8 min, 8 pages, 0 flagged, 0 fixes (all transcribed fresh). Shift the column grid (`proof_cols.py <page> 3 4 70`) on **odd** scan pages only; on even pages it cuts off the left column's chapter numbers, so use `3 4`. Blotted verse numbers and lost section letters are common here; where the body cites the passage, its § letter settles the index (e.g. 1 K 2:26 → 128 t, Ju 19:8 → 64 c) — search ws/pages.json for `book=X|chapter=N|verse=M`. Three index entries give printed page numbers instead of sections (1 S 14:34 'p. 286', 2 S 13:4 and 2 K 6:22 'p. 457 N¹'); S1 must remap them. Next: I07 (scan 606–).
- 2026-10-24 — I07 done: Index of Passages, scan 606–613 (Is 10:16 – Ps 12:2: rest of Isaiah, Jeremiah, Ezekiel, the Twelve, Psalms begins). 5.1 min, 8 pages, 0 flagged, 0 fixes (all transcribed fresh). On odd pages the shift can be too much: if the right edge of column B or C loses its section letters, recrop with a smaller shift (613 needed `3 4 30`). Column 3's chapter numbers are hidden in the gutter shadow on most odd pages; the tips at the right edge of column 2 plus the verse sequence recover them, and each such page's review item says so. Hb 3:13 on 612 confirms the 584 reconstruction (עָרוֹת → 75 aa). Next: I08 (scan 614–).
- 2026-10-24 — I08 done: Index of Passages, scan 614–621 (Ps 12:3 – 1 Ch 12:38: rest of Psalms, Proverbs, Job, the Megilloth, Daniel, Ezra–Nehemiah, start of 1 Chronicles). 6.5 min, 8 pages, 0 flagged, 0 fixes (all transcribed fresh; 617's Wikisource draft was raw OCR). `proof_cols.py`'s even thirds miss the columns on several of these pages (the gutter column sits off-centre); when a strip cuts letters, crop by hand from `proof/strips/<page>-trim.png` with `magick -crop`, as done for 615, 617, 619, 621. Blotted section numbers settled from the body again: 1 Ch 12:2 → 24 f. Next: I09 (scan 622, last index page), then the loop stops: only S1 is left.
- 2026-10-24 — I09 done: scan 622, the last Index of Passages page (1 Ch 15:12 – 2 Ch 36:23). 0 flagged, 0 fixes. **All proofreading chunks (B, P, I) are now done; only S1, the build, remains.** S1 is started by hand, not from the loop. Things the build must handle, gathered from the index runs: (1) three Passages entries cite printed page numbers ('p. 286', 'p. 457 N¹' ×2) that need remapping to the new layout; (2) the Hebrew-word index (566–588) and Passages index (589–622) are 3-column `{{colbegin}}` pages with `'''ch''' v | refs` rows and `== Book ==` headings; (3) every page has a review item in proof/review.tsv for Mitch to check against the scan.
- 2026-10-24 — S1 in progress (first full draft). `tools/build_book.py` (+ `tools/book_back.py` for paradigms and indexes) builds the whole book: `.venv/bin/python -I tools/build_book.py && (cd build && typst compile --font-path ../fonts book.typ book.pdf)` → 683 pages, ~5 s. Done: front matter (title, edition note with real figures, full contents, prefaces, abbreviations + SBL note, Siloam facsimile/photo cropped from the scan), parts/chapters/sub-heads (heading levels 1 Part, 2 Chapter, 3 sub-head, 4 §), paradigms A–Q, three indexes in columns with § links, 1910 page refs linked to margin markers, per-page footnote numbering by document order. Fixed in converter: footnotes/title text in GHGpar-heading's 4th slot (§§21, 44, 51, 65, 66, 93, 107, 124, 132, 133, 165 had lost them); an empty '' pair left by a dropped hyphenated word-end read as bold and inverted 47 paragraph numbers (pp. 139–196); added §54 e margin letter (review item). Whole-book check: scan-OCR words found on the same page, median 93%; outliers explained (footnotes kept whole across page breaks; OCR of transliterations). **Open:** (1) BIDI: Typst reverses adjacent Hebrew runs separated by punctuation (e.g. Paradigm A "אָנֹכִי; אֲנִי", body "הָעָם, לָעָם"); isolates and LRM do not help — tested in /tmp/fnt; next idea: lay each run out as its own box with fixed direction or test `text(dir: ltr)` on the separators, verifying with `pdftotext -bbox` word x-positions. (2) one footnote at a page break (§133–134) leaves Typst "did not converge" warnings; output is consistent. (3) 18 Babylonian vowel signs (scan 66) are marked placeholders; crop from scan 66–67. (4) 47 unresolved § links, nearly all to letters past a section's end (source slips); listed by the link check. (5) Alphabet table: not in the scanned copy; edition note says so. Then: spot-check ~20 pages, send Mitch the PDF.
- 2026-10-24 — S1 draft 2: 683 pages, compiles with **no warnings**. Resolved since draft 1: (1) the "reversed Hebrew order" was a misreading — my bidi tests had dropped the separator (a `;` after a `#…` expression is swallowed in Typst markup); `pdftotext -bbox` word positions confirm runs and index marks (? †) are in reading order. (2) The 20 Babylonian vowel signs of §8 g n. 3 are images cropped from scan 67 (`build/bab/01–20.png`, in order of appearance; `build_book.py` checks the count); the 2 signs Wikisource omitted were added to page 66 (review item), and page 66 is now done. (3) Footnote non-convergence: the per-page number changes width ("1" vs "3" in Plus Jakarta Sans, which has no tabular figures), reflowing the line and moving the note; markers are now fixed-width boxes. (4) A stray ";" printed after every 1910 page-marker label (`<orig-n>;`) — removed. Spot-checked ~20 pages across body, paradigms and indexes against the scan. Still open, for Mitch: the proof-review answers (apply with proof_fix.py, then rebuild); 47 § links that point past a section's last letter (source slips, left unlinked).
- 2026-10-24 — Print edition (for print-on-demand). One source, two outputs: `typst compile --font-path ../fonts book.typ book.pdf` (screen, colour) and `... --input edition=print book.typ book-print.pdf` (black and white, 703 pages). Print differs only through tokens in gesenius.typ (`is-print`/`pick`): greyscale palette, 0.9in gutter (KDP asks up to 0.875in at 701–828 pages), no hanging punctuation, 1910 page markers moved to the far edge of the outer margin (the gutter must stay empty), its own title page (nothing to the trim, so no bleed) and copyright page. Measured on every page: nothing within 0.893in of the spine or 0.25in of the trim; all fonts embedded; images ≥ 365 dpi (Babylonian signs now set at 1910 size = 400 dpi). Copyright-page fields and back-cover text come from `tools/print_details.json` (copy `print_details.example.json`; Mitch fills it in — licence, publisher, year, ISBN, back-cover text are his); the build prints "PRINT EDITION NOT READY" / "COVER NOT READY" until they are. Cover: `python3 tools/build_cover.py [--paper cream] [--guides]` then compile build/cover.typ — spine width is computed from book-print.pdf's page count (KDP white 0.002252 in/page), so rebuild the cover whenever the page count changes; for IngramSpark pass `--per-page` from its template. Not done: PDF/X conversion (needs Ghostscript, not installed; KDP accepts plain PDF, IngramSpark prefers PDF/X-1a); a physical proof copy.
