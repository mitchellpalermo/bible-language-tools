# hebrew.tools — Product Roadmap

A feature-by-feature development plan for hebrew.tools, modeled after the greek.tools toolset. Each section maps a greek.tools feature to its Biblical Hebrew equivalent, notes what is directly portable, what requires adaptation, and what is Hebrew-specific with no Greek analog.

Reference: see `greek-tools/FEATURES.md` for the complete greek.tools feature inventory.

---

## Starting Point

The current repository is a styled placeholder page with:
- Site shell (nav, footer, global CSS, PostHog analytics wiring)
- Noto Sans Hebrew already loaded via Google Fonts
- Brand identity established ("hebrew.tools", green primary color, RTL Hebrew ornament in the hero)
- Footer hover animation: "hebrew.tools" → "עִבְרִית כֵּלִים"

Everything needed to add the first real tool is already in place.

---

## Hebrew vs. Greek: Key Differences

Before planning features, it helps to understand where Biblical Hebrew diverges from Koine Greek in ways that affect implementation.

| Concern | Greek | Hebrew |
|---------|-------|--------|
| Text direction | Left-to-right | Right-to-left — requires `dir="rtl"` on all Hebrew text elements |
| Vowel system | Vowels are full letters | Vowels are optional diacritics (nikud/pointing) added below/above consonants |
| Script complexity | Monotonic → polytonic | Unpointed (consonants only) vs. fully pointed (BHS/WLC standard) |
| Verb system | Tense/voice/mood on one stem | Seven binyanim (stems): Qal, Niphal, Piel, Pual, Hiphil, Hophal, Hithpael |
| Root system | Word-forms derived from roots | Triliteral (3-letter) root system — pedagogy centers on roots, not lemmas |
| Weak verbs | Irregular verbs are a footnote | Weak verb classes (I-guttural, I-nun, hollow, geminate, etc.) are a core curriculum topic |
| Morphological data | MorphGNT — mature, clean, single canonical source | OSHB (Open Scriptures Hebrew Bible) — available, open-source, well-maintained |
| Keyboard input | Beta Code is standard | SBL transliteration mapping is common but less standardized; system keyboard layouts (Windows Hebrew) are an alternative |
| Font rendering | Well-supported in Noto Sans | Nikud + cantillation marks require careful font choice; Noto Sans Hebrew handles both |

---

## Phase 1 — Foundation: Hebrew Keyboard — ✅ Done

Merged in PR #71 (`src/lib/hebrew-input.ts` + `src/components/HebrewKeyboard.tsx`). Uses the SBL-style phonetic mapping (Option A below). Kept for reference — everything past this point builds on it.

**greek.tools analog:** `/keyboard` — `GreekKeyboard.tsx` + `src/lib/greek-input.ts`

The first deliverable. Establishes the Hebrew input pattern used by every subsequent tool.

### What to build

A textarea where users type phonetic/transliteration keystrokes and see live Biblical Hebrew output. Mirrors the greek.tools Beta Code approach.

### Hebrew keyboard mapping

Two approaches are worth considering:

**Option A: SBL-style phonetic mapping (recommended)**
Maps English letters to their closest Hebrew phonetic equivalent. Familiar to students who have learned SBL transliteration.

| Key | Hebrew | | Key | Hebrew |
|-----|--------|--|-----|--------|
| ' | א (alef) | | b | בּ (bet) |
| g | ג | | d | ד |
| h | ה | | w / v | ו |
| z | ז | | c | ח (het) |
| t | ט (tet) | | y | י |
| k | כ | | l | ל |
| m | מ | | n | נ |
| s | ס (samek) | | ` | ע (ayin) |
| p | פ | | x | צ (tsade) |
| q | ק | | r | ר |
| $ | שׂ (sin) | | # / S | שׁ (shin) |
| T | ת | | | |

**Option B: Direct Unicode input with diacritic keys**
Type consonants first, then add nikud with modifier keys (similar to beta code diacritics in greek.tools).

**Nikud (vowel points) — modifier approach:**
| Key combo | Nikud |
|-----------|-------|
| a | פַ patah |
| A | פָ qamets |
| e | פֶ segol |
| E | פֵ tsere |
| i | פִ hireq |
| o | פֹ holem |
| O | פוֹ holem waw |
| u | פֻ qibbuts |
| U | פוּ shureq |
| : | פְ sheva |
| :a | פֱ hateph patah |
| :e | פֱ hateph segol |
| :A | פֳ hateph qamets |

**Dagesh:** `*` or `.` after a consonant adds dagesh (פּ).

**Final forms:** Automatic — כ → ך, מ → ם, נ → ן, פ → ף, צ → ץ at word boundaries.

### Implementation notes
- `dir="rtl"` on the textarea
- Cursor position management is more complex RTL — test carefully with `selectionStart`/`selectionEnd`
- Unicode combining marks (nikud) are codepoints U+05B0–U+05C7; they apply to the preceding consonant
- Copy-to-clipboard works the same as greek.tools
- Diacritic reference chart in the UI is essential for learners

---

## Phase 2 — Vocabulary Flashcards

**greek.tools analog:** `/flashcards` — `Flashcards.tsx` + `src/data/vocabulary.ts` + `src/data/srs.ts`

### What ports directly

The entire SRS system (`srs.ts`) is language-agnostic and can be copied verbatim:
- SM-2 algorithm, `SRSCard` interface, streak tracking, `loadSRSStore`/`saveSRSStore`
- All localStorage persistence logic
- Answer checking with Levenshtein distance

The `Flashcards.tsx` component logic (study modes, filters, flip/type answer modes, streak display) ports with only surface changes to strings and data shape.

### What changes

**Vocabulary dataset** — needs a new `src/data/vocabulary.ts` for Biblical Hebrew:

```ts
interface HebrewVocabWord {
  hebrew: string;       // fully pointed form (BHS standard)
  root?: string;        // triliteral root (optional — not all words have one)
  transliteration: string;  // SBL transliteration
  gloss: string;
  frequency: number;    // occurrences in Hebrew Bible
  partOfSpeech: string;
  binyan?: string;      // for verbs: Qal, Niphal, Piel, etc.
}
```

**Frequency data source:** Open Scriptures Hebrew Bible (OSHB) morphological data provides frequency counts. Alternatively, Mitchel Seow's or Mounce's frequency lists are widely used in seminary curricula.

**Suggested initial dataset:** Top 500 Hebrew Bible words by frequency. Roughly:
- Frequency ≥ 500: ~170 words (covers ~80% of running text)
- Frequency ≥ 100: ~500 words (covers ~90% of running text)
- Common pedagogical grouping: vocabulary from Kelley's Biblical Hebrew, Pratico & Van Pelt, or Futato

**Filter options to add (Hebrew-specific):**
- By frequency band (same as greek.tools)
- By part of speech
- By root (group cards by the same triliteral root)
- ~~By vocabulary source (e.g., "Pratico & Van Pelt Ch. 1–5")~~ — shipped as textbook
  chapter decks. Words carry a `chapters` tag; `src/data/textbooks.ts` turns those
  tags into decks. Garrett & DeRouchie ch. 1 is populated; chapters 2+ are added by
  tagging words in `vocabulary.ts`, no UI change needed.

**Direction modes:**
- Hebrew → English gloss (same as Greek → English)
- English → Hebrew (typing Hebrew requires the Keyboard tool — consider linking them)
- Transliteration → Hebrew (useful early in the curriculum)

**localStorage keys (new namespace):**
- `hebrew-tools-srs-v1` — SRS card store
- `hebrew-tools-stats-v1` — study stats

### Bite-sized PR breakdown

This phase is scoped as three sequential PRs rather than one, so each is small enough to land on its own:

| PR | Scope | Issue |
|----|-------|-------|
| 2a | Vocabulary dataset only — ~50 hand-curated, high-confidence words. No UI. | #72 — ✅ done |
| 2b | Core flashcards UI — SRS + "all" study modes, flip mode only, Hebrew→English only, frequency filter | #73 — ✅ done |
| 2b′ | Textbook chapter decks (`src/data/textbooks.ts`) + noun gender on cards | — ✅ done |
| 2c | Typing answer mode (via Phase 1 keyboard), English→Hebrew and transliteration→Hebrew directions, POS/root filters | #74 |

The custom deck builder that greek.tools' `Flashcards.tsx` also has (generate a deck from a passage) is explicitly out of scope here — it's tied to a Focus-Passage-equivalent feature that doesn't exist yet for Hebrew.

**Note on frequency data:** greek.tools' `vocabulary.ts` is a generated file, produced from MorphGNT by `build-vocabulary.mjs`. Hebrew now has its own `scripts/build-vocabulary.mjs` (issue #109): the 546 textbook entries carry real per-lemma counts over the WLC, along with roots, Strong's numbers and parts of speech, while the handout keeps the chapter map and the gloss wording. The remaining approximate numbers are on the hand-curated entries in `vocabulary.ts` that no textbook chapter tags.

---

## OSHB Data Pipeline (elevated out of Phases 3/4) — ✅ Done

**Issue:** #75

Originally described inline under Phases 3 and 4 below, but promoted to its own standalone task: both of those phases need it, and it's a self-contained, mechanical PR on its own (mirrors `apps/greek-tools/scripts/build-morphgnt.mjs`) rather than something that should be built twice or bundled into a larger feature PR.

`scripts/build-morphhb.mjs` now writes three things to `public/data/morphhb/`:

| File | Contents |
|------|----------|
| `{CODE}.json` | per book — `{ [chapter]: { [verse]: HebrewWord[] } }`, 305,516 words across 39 books |
| `books.json` | the book index in Tanakh order, with `section`, chapter and word counts |
| `lemmas.json` | 9,256 lemmas → `{ count, hebrew?, xlit?, pos?, gender?, root? }` |

`src/data/morphhb.ts` is the client side. Invariants and traps are recorded in
`CLAUDE.md` under "OSHB data pipeline" — read those before touching the parser.

Two things it deliberately does **not** do, both because they belong to the phases
that first need them:

- **No parse-code formatter.** Turning `HC/Vqw3ms` into "Conjunction; Qal
  wayyiqtol 3ms" wants its own tables and tests, and Phases 3 and 4 need it
  together. `parsing` carries the full OSHB string, losslessly, until then.
- **No glosses.** `lemmas.json` carries orthography, POS, gender, root and
  frequency — not meaning. The gloss-dataset decision below is still open, and
  the quiz-facing glosses stay Garrett's regardless (see `CLAUDE.md`).

The per-lemma counts are real occurrence counts over the WLC and are the
authoritative frequency source going forward. The textbook vocabulary is
re-sourced from them by `scripts/build-vocabulary.mjs` (issue #109); see
`CLAUDE.md`, "Split authority: the handout and OSHB".

---

## Phase 3 — Daily Verse

**greek.tools analog:** `/daily` — `DailyVerse.tsx` + `src/data/dailyVerses.ts` + `src/data/dailyDose.ts`

### What ports directly
- Streak tracking logic (from `srs.ts` — `DailyStreakData`, `loadStreakData`, `markReadToday`)
- "Show glosses" toggle UX
- Word-click popup pattern (lemma, gloss, parse, frequency)
- sessionStorage caching pattern

### What changes

**Verse source:**
- No direct equivalent to Daily Dose of Greek exists for Hebrew. Use a curated list as the primary source.
- Potential secondary source: Bible Gateway or similar APIs (check licensing), or the YouVersion API

**Curated verse list:** Aim for ~60–90 verses spread across Torah, Prophets (Nevi'im), and Writings (Ketuvim). Prioritize:
- Frequent vocabulary
- Pedagogically useful morphology
- Well-known passages (Genesis 1:1, Deuteronomy 6:4, Psalm 23:1, etc.)

**Display considerations:**
- Hebrew text must render RTL with `dir="rtl"`
- Verse reference format: "Genesis 1:1" or "בְּרֵאשִׁית א:א" — show both
- Cantillation marks (te'amim) in WLC text: consider a toggle to hide them for beginning students

**Studied-word highlighting:** same pattern as greek.tools — words with `repetition > 0` in the SRS store get highlighted.

---

## Phase 4 — Hebrew Bible Reader

**greek.tools analog:** `/reader` — `GNTReader.tsx` + `src/data/morphgnt.ts` + `public/data/morphgnt/*.json`

This is the largest single feature and the anchor of the site.

**Built** — all five sub-issues have landed: the morph-code formatter (#117), the
Strong's gloss source (#118), the reader shell (#119), the word popup (#120) and
the reading aids (#121). What the code does and what will bite if it is changed
carelessly is in `CLAUDE.md` under "The reader"; the rest of this section is the
plan it was built from.

### Data source: Open Scriptures Hebrew Bible (OSHB)

- GitHub: [openscriptures/morphhb](https://github.com/openscriptures/morphhb)
- License: CC BY 4.0 — same as MorphGNT, fully usable
- Format: XML (OSIS) with morphological tags per word
- Coverage: Full Hebrew Bible (39 books) — Torah, Nevi'im, Ketuvim
- Text: Westminster Leningrad Codex (WLC) — the standard critical text

**Build script** (analog to `scripts/build-morphgnt.mjs`): Parse OSHB XML → JSON format per book, stored in `public/data/morphhb/*.json`.

### Morphological data format

OSHB parse codes use a different scheme than MorphGNT. Each word has:

```ts
interface HebrewMorphWord {
  text: string;         // pointed Hebrew text as it appears
  lemma: string;        // lexical form (Strong's number or BDB reference)
  pos: string;          // part-of-speech code (OSHB scheme)
  parsing: string;      // morphological parse string
  root?: string;        // triliteral root
}
```

**OSHB part-of-speech codes:**

| Code | Meaning |
|------|---------|
| `HVq` | Verb, Qal |
| `HVn` | Verb, Niphal |
| `HVp` | Verb, Piel |
| `HVP` | Verb, Pual |
| `HVh` | Verb, Hiphil |
| `HVH` | Verb, Hophal |
| `HVt` | Verb, Hithpael |
| `HNm` | Noun, masculine |
| `HNf` | Noun, feminine |
| `HPp` | Preposition |
| `HAd` | Adjective |
| `HPr` | Pronoun |
| `HCj` | Conjunction |
| `HAv` | Adverb |

**Verbal parse dimensions (Hebrew):**
- Stem (binyan): Qal / Niphal / Piel / Pual / Hiphil / Hophal / Hithpael
- Conjugation: Perfect / Imperfect / Imperative / Infinitive Construct / Infinitive Absolute / Participle
- Person: 1st / 2nd / 3rd
- Gender: Masculine / Feminine / Common
- Number: Singular / Plural / Dual

**Nominal parse dimensions:**
- Case is not marked in Hebrew (unlike Greek)
- Gender: Masculine / Feminine / Common
- Number: Singular / Plural / Dual
- State: Absolute / Construct / Determined (for Aramaic sections)

### What ports directly
- Book/chapter navigation UI
- URL persistence (`?ref=GEN.1`)
- localStorage last-read passage (`hebrew-tools-reader-last`)
- Word popup pattern (lemma, gloss, parse, frequency)
- Studied-word highlighting (cross-reference with SRS store)
- Home page "Continue reading" link

### What changes
- `dir="rtl"` on all Hebrew text; verse numbers and UI chrome stay LTR
- Word popup must show: pointed form, root, transliteration, binyan (for verbs), gloss, parse, frequency
- "Show cantillation" toggle — hide te'amim for beginners
- Strong's number display (optional) — many seminary students use Strong's for concordance work
- Lexicon source: map lemmas to BDB/HALOT glosses (requires a gloss dataset — see below)

### Gloss dataset

Unlike greek.tools (which uses a hand-curated 50-word vocabulary as the gloss source), the Hebrew Bible Reader needs glosses for the full Hebrew vocabulary (~8,000 unique lemmas). Options considered:

1. **BDB (public domain):** Brown-Driver-Briggs Hebrew Lexicon — scanned/digitized versions exist; no clean machine-readable form without cleanup work
2. **OpenHebrew / STEPBible TIPNR:** STEPBible project provides open-licensed lemma → gloss mappings — machine-readable, but a second upstream to pin and track
3. **OSHB embedded glosses:** The OSHB lexicon ships `HebrewStrong.xml` — Strong's definitions, already fetched and already pinned by the build
4. **Hand-curated for top-frequency words:** Same approach as greek.tools — start with the top 500 words and expand

**Decided: 3** (issue #118). Strong's is the only option that adds no upstream, no licence question and no pinning decision — the pipeline already fetches that repository at a fixed commit.

**The textbook is deliberately not layered over it.** Garrett & DeRouchie's wording is the answer key for the deck built from that textbook, where a quiz is marked against the page. It is not a general-purpose lexicon, and letting it win across the whole Hebrew Bible would make a word's meaning depend on whether a course happened to teach it — the reader would say one thing about חֶסֶד in Genesis and the lexicon another in Isaiah. The split is by use: Flashcards reads the vocabulary, the reader reads the lexicon.

Two things that shape the implementation:

- Prefer the `<def>` elements inside `<meaning>` over `<usage>`. `<usage>` is the KJV's translation words with all the apparatus — H1 reads `chief, (fore-) father(-less), × patrimony, principal.` where the `<def>` reads `father`.
- BDB sense splits collapse: `5892a` and `5892b` both resolve to H5892 and get the same gloss, because Strong's draws no distinction there. Frequency deliberately behaves the other way — counts sum across sense splits and never across homographs.

---

## Phase 5 — Transliteration Converter

**greek.tools analog:** `/transliteration` — `Transliteration.tsx` + `src/lib/transliteration.ts`

### What ports directly
- Bidirectional textarea UI
- Copy buttons
- Live sync on input

### What changes

Hebrew → SBL transliteration is more complex than Greek because:
- Consonants have multiple phonetic values (ב = b with dagesh, v without)
- Nikud must be mapped (patah → a, qamets → ā, etc.)
- Sheva is either vocal (e) or silent (nothing)
- Qamets can be qamets gadol (ā) or qamets qatan (o) — requires syllable analysis for strict SBL

**Suggested initial scope:** consonants + nikud → SBL, no vocal/silent sheva distinction (mark all sheva as ə). Full sheva analysis is a v2 enhancement.

**SBL Hebrew transliteration scheme (simplified):**

| Hebrew | SBL | | Hebrew | SBL |
|--------|-----|--|--------|-----|
| א | ʾ | | ב (dagesh) | b |
| ב (no dagesh) | v | | ג | g |
| ד | d | | ה | h |
| ו | w | | ז | z |
| ח | ḥ | | ט | ṭ |
| י | y | | כ (dagesh) | k |
| כ (no dagesh) | k | | ל | l |
| מ | m | | נ | n |
| ס | s | | ע | ʿ |
| פ (dagesh) | p | | פ (no dagesh) | f |
| צ | ṣ | | ק | q |
| ר | r | | שׁ | š |
| שׂ | ś | | ת | t |

---

## Phase 6 — Grammar Reference

**greek.tools analog:** `/grammar` — `GrammarReference.tsx` + `src/data/grammar.ts`

### What ports directly
- Section-nav sidebar pattern
- Sticky nav / mobile horizontal scroll nav
- Paradigm card component architecture
- Hover/tap tooltips
- Full-form / endings-only toggle (applicable to noun patterns)

### Hebrew grammar sections

| Section | Contents |
|---------|----------|
| **Alphabet** | 22 consonants with names, values, dagesh forms, final forms |
| **Vowels** | Nikud chart — all 9 full vowels + 3 reduced vowels (hateph) + sheva |
| **Nouns** | Masculine/feminine absolute & construct singular/plural/dual; segolate nouns; nouns with suffixes |
| **Pronouns** | Independent personal; demonstrative; interrogative; relative (אֲשֶׁר) |
| **Prepositions** | Inseparable (בּ, לְ, כְּ, מִן) + common independent prepositions + pronominal suffixes on prepositions |
| **The Article** | הַ with dagesh forte — forms before gutturals and ר |
| **Qal Verb** | Perfect, Imperfect, Imperative, Inf. Construct, Inf. Absolute, Active Participle, Passive Participle — strong verb paradigm |
| **Derived Stems** | Niphal, Piel, Pual, Hiphil, Hophal, Hithpael — full paradigms |
| **Weak Verbs** | I-guttural, II-guttural, III-ה, I-נ, I-י/ו, Hollow (II-ו/י), Geminate — comparative paradigm per stem |
| **Pronominal Suffixes** | On nouns (singular/plural), on verbs (perfect/imperfect) |
| **Verbal Nouns & Participles** | Inf. construct uses as noun/preposition + pronominal suffix patterns |
| **Waw Consecutive** | Wayyiqtol (imperfect + waw consec.), Weqatal (perfect + waw consec.) with accent shifts |
| **Numerals** | Cardinals 1–10 (abs/constr M/F), teens, decades |

### Hebrew-specific complexity note

The weak verb section has no Greek analog. Strong-verb paradigms are 6 conjugation forms × 7 stems = 42 paradigms. Adding weak verb classes multiplies this substantially. A good UX strategy:

- Default view: strong verb paradigm
- Dropdown to overlay: select a weak-verb class to see where it diverges
- Highlight cells that differ from the strong verb in a different color

---

## Phase 7 — Paradigm Quiz

**greek.tools analog:** `/paradigms` — `ParadigmQuiz.tsx` + `src/lib/paradigm-quiz.ts`

### What ports directly
- Three-phase quiz UX (Select → Quiz → Results)
- `TableModel` / `TableRow` data structure
- Cell blanking by density (easy/medium/hard)
- Color-coded results (correct / accent-only / wrong)
- localStorage settings persistence
- Diacritic reference chart

### What changes

**Hebrew-specific grading nuance:**
- "Accent-only" equivalent: nikud present but incorrect vs. consonants correct
- "Dagesh-only" error: word form correct but missing/extra dagesh forte
- Strict vs. lenient mode: lenient ignores nikud errors; strict requires full pointing

**Paradigm categories for quiz:**

| Category | Example paradigms |
|----------|------------------|
| Nouns | Masculine sg/pl/dual abs/constr; Feminine sg/pl abs/constr |
| Pronouns | Independent personal (all persons/genders/numbers) |
| Qal Verb | Perfect, Imperfect, Imperative, Participle |
| Derived Stem Verbs | One quiz per stem (7 total) |
| Prepositions + suffixes | Inseparable prep + all pronominal suffixes |
| Nouns + suffixes | Noun with all pronominal suffixes |
| Weak Verbs | Per class — I-guttural Qal, III-ה Qal, etc. |

The input system uses the Hebrew Keyboard mapping from Phase 1 (or a simplified subset), so the Keyboard tool is a prerequisite.

---

## Phase 8 — Hebrew-Specific Features (No Greek Analog)

These features have no direct equivalent in greek.tools and are unique to Biblical Hebrew pedagogy.

### 8A. Root Lookup Tool

Hebrew vocabulary is organized around triliteral roots. A dedicated root browser would let students:
- Enter a 3-letter root (or search by consonants)
- See all words derived from that root with glosses and frequencies
- Filter by part of speech or binyan
- See how the root behaves in each verbal stem

**Data:** OSHB lemma data + a root → lemma mapping table.

### 8B. Parsing Practice (standalone)

Unlike the Paradigm Quiz (which tests paradigm tables), Parsing Practice presents a fully inflected word form and asks students to identify:
- Binyan (stem)
- Conjugation (perfect/imperfect/etc.)
- Person / gender / number
- Lexical root / lemma

This mirrors the core skill tested in most Biblical Hebrew exams and differs from greek.tools' Paradigm Quiz, which focuses on form production rather than analysis.

**Data source:** Pull random words from OSHB morphological data — the parse answer is embedded in the source.

### 8C. Binyan Overview / Verb Stems Guide

An interactive explainer of the seven binyanim with:
- Meaning/function of each stem (Qal = G-stem/basic; Niphal = N-stem/passive-reflexive; etc.)
- How the same root changes meaning across stems (e.g., קדשׁ in Qal, Piel, Hiphil)
- Representative strong-verb paradigm comparison table across all 7 stems in one view

This is the most-requested feature for seminary Hebrew students and has no Greek equivalent.

---

## Phase 9 — Stylus Writing Practice (`/write`)

**greek.tools analog:** none yet — this phase builds the shared engine and greek.tools inherits it (9g).

`/keyboard` is labeled **Type**. This is its sibling, **Write**: a stylus surface for handwriting Hebrew, aimed squarely at an iPad and Apple Pencil. Handwriting is how the alphabet, the nikud, and the paradigms actually get learned, and it is the one part of a first-year Hebrew course that no web tool covers.

The pedagogy is the spine, not the stylus: every drill runs **trace → copy → recall**. Trace a ghosted glyph, then copy one shown beside an empty box, then produce it from the letter's name or an English gloss alone.

### Modes

| Mode | Content source | Notes |
|------|---------------|-------|
| **Letters** | Script pack | The 22 letters as 23 cards (shin and sin are drilled apart, since the dot's side is the skill), 5 final forms, begadkephat dagesh variants. A separate deck interleaves the confusable pairs — ב/כ, ד/ר, ה/ח/ת, ו/ז/ן, ס/ם, ע/צ — since that is where beginners actually lose marks. **Glyphs are drilled in the form they are actually written**: final kaf carries its silent sheva (ךְ), shin and sin their dots. A chart built from bare codepoints teaches forms that occur nowhere in the text |
| **Nikud** | Script pack | Vowel points on a host consonant. *Placement* is most of the skill (qamets centered below, holem above-left). Shipped in 9c — and it needed a scoring change, see below |
| **Words** | `vocabulary.ts`, `textbooks.ts` | RTL grid of guide boxes, one per consonant cluster. Prompted by gloss or transliteration |
| **Paradigms** | `TableModel` (Phase 7) | Handwrite into blanked cells instead of typing. Same density picker, same result colors. This is the exam-prep mode |
| **Scribal copying** | Daily Verse / reader text | Long-form, lightly graded. Fill a column of a page over successive days |

Writing into per-letter guide boxes is a deliberate design choice: it removes ink segmentation from the problem entirely. The student says where each letter ends, so the engine never has to guess.

### Grading — three layers that degrade gracefully

**Layer 0 — self-assessment.** Write, reveal the reference overlaid on the ink, grade Again/Hard/Good/Easy. No new data and no new failure modes, and it feeds `nextSRS` from `@tools/shared/srs` unchanged. Shippable on its own.

**Layer 1 — geometric scoring against a font-rendered mask.** *Shipped in 9b.* No hand-authored glyph outlines are needed, because the app already loads Noto Sans Hebrew:

1. Rasterize the target glyph to an offscreen canvas, fit to its own bounds and centered.
2. Take the alpha channel as a binary mask; run a two-pass chamfer distance transform.
3. Normalize the ink into the same box and score three numbers:
   - **Accuracy** — fraction of ink points within tolerance of the glyph (≈ 8% of the box)
   - **Coverage** — fraction of glyph pixels near some ink point; catches a half-drawn ה
   - **Spill** — mean distance of the worst decile of ink points; catches stray marks

Deterministic, sub-millisecond, no network and no model, and identical for Greek — the only inputs are a font family and a glyph string.

Two traps: `await document.fonts.load(...)` before rasterizing or the grading runs against a fallback font, and cache masks per glyph.

Three things the build settled that the plan above did not:

- **The grid is 128, not 256.** A mask's distance transform is cached, but the *ink's* is rebuilt every attempt, and both are linear in cell count — so the grid side lands quadratically on per-attempt cost (256 measures ~1.15 ms against 128's ~0.32 ms). At 128 a stem is still ~15 cells across, far more than an occupancy metric can use.
- **The three numbers combine as a geometric mean, not a weighted sum.** Under any fixed weighting, accuracy can buy off coverage: half a ה scores 84/100 because "every mark is in the right place" banks the whole accuracy term. Requiring *both* to be good is what the three metrics were for.
- **Coverage runs through a response curve first.** Linear coverage is far too forgiving — a ה missing its roof reads as 65% covered, which sounds like a near miss and is very nearly a different letter.
- **Scoring searches over placements, because bounding-box normalization decides the registration** (#114, shipped after 9c). Absolute position was already irrelevant — both sides are fitted to their own bounds — but both are pinned by their *extreme* points, so a stroke overshooting the printed glyph's ceiling by a few percent shifts the whole letter body and every metric reads the shift as letterform error. A real alef lost about 13 points of a 40 that way. `scoreInk` now takes the best of ~74 bounded integer offsets. The objective is deliberately overlap alone: `placement` and `spill` are measured *at* the winning offset and never help choose it, or the search would slide a misplaced vowel point into its slot.

**Layer 1b — placement, for glyphs that are "another glyph plus a mark".** *Shipped in 9c.* The plan above assumed nikud would score natively, because the mask grades the rendered consonant-plus-point as one image. It does not, and the reason is arithmetic: a vowel point is about 4% of the composed glyph's cells, so writing the qamets where the holem goes moves the combined score by roughly three points out of a hundred. All three metrics above are area measurements, and area is the one thing a diacritic does not have.

What closes it costs one function and no new data. `rasterizeComposite(text, base)` renders both the composed form and its base, takes the pixel difference, and fits *both* to the composed form's bounds — so the mark comes back as a mask in the whole glyph's frame rather than one fitted to itself. `scoreInk` takes it as `part` and reports a fourth number, `placement`, which folds in as a geometric mean alongside the shape term. A qamets in the wrong place now reads as a miss; the same attempt scored against the whole mask alone still reads as a pass, and a test pins exactly that gap.

It applies to more than the vowels: `WritableGlyph.baseForm` marks שׁ and שׂ as ש-plus-a-dot, so the dot's side finally counts. Two traps, both documented in the repo CLAUDE.md: the two rasterizations must be anchored on the leading edge rather than centred (or a composed form wider than its base shifts the base between them), and an empty difference must be read as "not graded" rather than as a failed attempt.

**Known limitation:** this still grades shape *occupancy*, not letter identity or stroke order. A ד drawn as a ר plus a stray tick scores decently. Layer 2 is what closes that.

**Layer 2 — stroke order and direction.** A hand-authored `StrokeTemplate` per glyph: ordered polylines in a normalized 0–1 box, each with a direction. Hebrew needs ~45 entries (22 consonants + 5 finals + shin/sin dots + ~13 nikud); Greek ~60. Bootstrap the data with the app itself — an internal authoring route where each glyph is drawn once with the stylus and saved as JSON.

Matching resamples both user and template stroke to 32 points and compares mean distance, with direction from the endpoint vector's sign. The payoff is coaching text rather than a number: *"Stroke 2 went bottom-to-top — ד draws the roof right-to-left first, then the leg down."* It also gives nearest-template classification nearly free, which turns "you scored 61" into "you wrote a ר."

### Stylus specifics

Apple Pencil reaches the page through standard Pointer Events — `pointerType === 'pen'`, with real `pressure` and `altitudeAngle`/`azimuthAngle`. No native code and no App Store. What the engine has to get right:

- **`getCoalescedEvents()`.** The Pencil samples far faster than `pointermove` fires; without the coalesced samples, fast strokes render visibly polygonal. Feature-detect it and fall back to the single event.
- **Palm rejection.** Once any `pen` event is seen, `touch` pointers stop drawing and go back to scrolling. A small state machine, and a pure one.
- **Pressure-driven width**, built as an offset ribbon rather than `lineWidth` (which cannot vary mid-path). This is the single biggest factor in whether the surface feels like a pen.
- **A one-euro filter** on input plus Catmull-Rom on render — Pencil jitter at slow speeds is real.
- **Safari hygiene:** `touch-action: none`, `-webkit-touch-callout: none`, `user-select: none`, `overscroll-behavior: contain`, and `setPointerCapture` so a stroke leaving the canvas keeps tracking.
- **Write-big-place-small.** A 44px paradigm cell is unwritable. Tapping a cell opens an oversized surface below the grid and the graded result renders back into the cell. This also answers right-hand occlusion, a genuine problem when writing right-to-left.
- **Replay.** Timestamps are captured anyway, so scrubbing a stroke back costs almost nothing — and replaying it against the reference stroke order animating alongside is the best teaching moment in the feature.

Mouse input works through the same code path with constant pressure, which is what makes desktop development and Playwright coverage possible.

**Not available to web pages:** Pencil double-tap and Pencil Pro squeeze. Tool switching must be on-screen.

### Portability to greek.tools

Everything language-specific collapses into one interface, and greek.tools gets `/write` by authoring a single data file plus one `navLinks` entry.

```ts
export interface ScriptPack {
  id: 'hebrew' | 'greek';
  direction: 'rtl' | 'ltr';
  fontFamily: string;
  fontLoadSpec: string;              // for document.fonts.load()
  glyphs: WritableGlyph[];           // char, name, phonetic, group, confusableWith, baseForm
  strokes?: Record<string, StrokeTemplate>;
  combining?: { hostChar: string; marks: WritableGlyph[] };  // nikud / breathings + accents
  metrics: { emBox: number; baseline: number; ascender: number; descender: number };
}
```

```
packages/shared/src/ink/
  stroke.ts       Stroke/Point types, resample, normalize, bbox
  smooth.ts       one-euro filter, Catmull-Rom
  capture.ts      pointer → strokes, palm rejection, coalesced sampling
  render.ts       variable-width ribbon → Path2D
  script-pack.ts  the types above
  score/mask.ts   glyph → coverage mask + distance transform
  score/geom.ts   accuracy / coverage / spill → 0–100
  score/order.ts  stroke-order matcher
  components/     InkCanvas, TracePanel, WritingGrid
```

Components added to `packages/shared` must be self-styled with plain CSS and design tokens — Tailwind's content detection is per-app and does not scan the package.

### Storage

Ship v1 with **no schema change.** Writing attempts become ordinary SRS cards in the existing store under a `write:` key prefix (`write:letter:א`, `write:cell:qal-perf:3ms`), so they sync through `/api/progress` on day one and streaks and stats work immediately. The key-namespace convention needs documenting, since those keys are bare lemmas today.

Ink stays local in IndexedDB, quantized to int16 — roughly 2 KB per letter, so keeping several attempts per glyph is free. Syncing ink is a separate, later decision: extending `ProgressPayload` means touching `packages/db` schema, `sync-merge`, and `progress-store`, all governed by the D1 language-scoping invariant. Not free, and not needed for v1.

### Testing

The architecture is shaped so the interesting parts are pure functions over typed arrays, testable without a canvas: resampling, mask generation, the distance transform, the scoring formula (synthetic perfect ink ≈ 100, scribble ≈ low), the stroke-order matcher, and the palm-rejection state machine. Integration tests drive `InkCanvas` with synthetic `PointerEvent`s in happy-dom. Playwright covers one flow end to end: draw, score, advance.

### Bite-sized PR breakdown

| PR | Scope |
|----|-------|
| 9a | ✅ Ink capture + render in shared; `/write` letters, trace mode, Layer 0 self-grading, SRS wired |
| 9b | ✅ Layer 1 mask scoring + numeric feedback |
| 9c | ✅ Nikud drills and confusable-pair decks (plus Layer 1b placement scoring) |
| 9d | `WritingGrid` + word mode from `vocabulary.ts` / `textbooks.ts` |
| 9e | Stroke templates + authoring route + Layer 2 coaching |
| 9f | Paradigm writing over `TableModel` |
| 9g | greek.tools `ScriptPack` + `/write` |

9a is usable on its own for alphabet drilling. 9f depends on Phase 7's `TableModel` existing.

---

## Technical Notes

### Right-to-Left (RTL) layout
- Set `dir="rtl"` on every element containing Hebrew text
- Verse numbers and UI controls (buttons, labels) stay LTR — use `dir="ltr"` or `unicode-bidi: isolate` as needed
- Bidirectional text in word popups requires careful `dir` scoping
- CSS `text-align: right` is not sufficient — always use the `dir` attribute

### Font
Noto Sans Hebrew (already loaded) renders nikud and cantillation correctly. No font change needed.

### Unicode blocks
- Hebrew consonants: U+05D0–U+05EA
- Nikud (vowel points): U+05B0–U+05C7
- Cantillation (te'amim): U+0591–U+05AF, U+05BD, U+05BF, U+05C0, U+05C3, U+05C6
- When stripping nikud for lenient comparison, strip U+05B0–U+05C7 (keep consonants)
- When stripping all cantillation, also strip U+0591–U+05AF

### OSHB data pipeline — built, see the section above
- Sources: `openscriptures/morphhb` (`wlc/*.xml`) and `openscriptures/HebrewLexicon` (`AugIndex.xml`, `LexicalIndex.xml`), both CC BY 4.0
- Build script: `scripts/build-morphhb.mjs`, parsing in `scripts/lib/oshb.mjs`, client access in `src/data/morphhb.ts`
- Book codes: GEN, EXO, LEV, NUM, DEU, JOS, JDG, RUT, 1SA, 2SA, 1KI, 2KI, 1CH, 2CH, EZR, NEH, EST, JOB, PSA, PRO, ECC, SNG, ISA, JER, LAM, EZK, DAN, HOS, JOL, AMO, OBA, JON, MIC, NAH, HAB, ZEP, HAG, ZEC, MAL — the table in `scripts/lib/books.mjs` is the source of truth, in Tanakh order
- Full Hebrew Bible: 39 books, 305,516 words, 9,256 lemmas
- Chapter divisions are the Tanakh's: Joel has 4 chapters, Malachi 3

### Shared code candidates from greek.tools
The following modules from greek.tools can be copied with minimal or zero changes:
- `src/data/srs.ts` — rename localStorage keys, rest is language-agnostic
- `src/lib/quiz-settings.ts` — rename localStorage key only
- `src/components/grammar/NumberToggle.tsx` — purely UI, no language dependency
- `src/components/grammar/EndingsToggle.tsx` — same
- `src/components/grammar/SectionHeading.tsx` — same
- `src/components/grammar/DescriptionBar.tsx` — same
- PostHog initialization pattern in `Layout.astro` — already present

---

## Suggested Build Order

| Order | Phase | Feature | Complexity | Dependency | Status | Issue |
|-------|-------|---------|------------|------------|--------|-------|
| 1 | 1 | Hebrew Keyboard | Medium | None | ✅ Done | #71 (PR) |
| 2 | 2a | Vocabulary dataset | Low | None | Next up | #72 |
| 3 | 2b | Core flashcards UI | Low | 2a | Queued | #73 |
| 4 | 2c | Flashcards: typing + directions + filters | Low–Medium | 2b, Phase 1 | Queued | #74 |
| 5 | — | OSHB data pipeline | Medium (mechanical) | None | ✅ Done | #75 |
| 6 | 3 | Daily Verse | Medium | OSHB pipeline | Queued | #76 |
| 7 | 5 | Transliteration | Medium | None | Queued (independent — can float earlier if a break is wanted) | #78 |
| 8 | 4 | Hebrew Bible Reader | High — broken into 4a–4e | OSHB pipeline, gloss dataset decision | ✅ Done | #77 |
| 8a | 4a | Reader: OSHB morph-code formatter | Low | OSHB pipeline | ✅ Done | #117 |
| 8b | 4b | Reader: gloss source (Strong's, from the pinned OSHB lexicon) | Low | OSHB pipeline | ✅ Done | #118 |
| 8c | 4c | Reader: shell — book/chapter nav, RTL verses | Medium | OSHB pipeline | ✅ Done | #119 |
| 8d | 4d | Reader: word popup — morphemes, parse, gloss | Medium | 4a, 4b, 4c | ✅ Done | #120 |
| 8e | 4e | Reader: cantillation toggle + studied-word highlighting | Low | 4c | ✅ Done | #121 |
| 9 | 6 | Grammar Reference | High (content-heavy) — needs its own sub-breakdown by section | None | Queued (independent — can float earlier) | #79 |
| 10 | 7 | Paradigm Quiz | Medium | Phase 1, Phase 6 | Queued | #80 |
| 11 | 8C | Binyan Guide | Low (content) | None | Queued (independent — can float earlier) | #83 |
| 12 | 8A | Root Lookup | Medium | Phase 4 data | Queued | #81 |
| 13 | 8B | Parsing Practice | Medium | Phase 4 data | Queued | #82 |
| 14 | 9a | Writing: ink engine + `/write` letters | Medium | None | In progress | #99 |
| 15 | 9b | Writing: mask scoring | Low–Medium | 9a | Queued | #100 |
| 16 | 9c | Writing: nikud + confusable decks | Low | 9b | Queued | #101 |
| 17 | 9d | Writing: word mode + guide grid | Low–Medium | 9b | Queued | #102 |
| 18 | 9e | Writing: stroke order + coaching | Medium | 9a | Queued (independent of 9b–9d) | #103 |
| 19 | 9f | Writing: handwritten paradigms | Medium | 9d, Phase 7 | Queued | #104 |
| 20 | 9g | Writing: port to greek.tools | Low | 9b (9e for coaching) | Queued | #105 |

Every row above is one GitHub issue, and every issue is scoped to land as a single PR. Phase 4 and Phase 6 were too large for that and get their own bite-sized sub-issues (same pattern as Phase 2) once picked up — Phase 4 has been, and its five sub-issues are listed as rows 8a–8e. Rows marked "independent" have no hard dependency on the row above them — they're placed here for logical flow (data-pipeline-dependent work grouped together) but can be pulled earlier as a change of pace between heavier phases.

The OSHB data pipeline (needed for Phases 3 and 4, and for accurate Flashcards frequency data) is the most important early infrastructure investment — see the standalone section above.

Phase 9 sits at the end of the table for logical flow, but only 9f has a hard dependency on earlier phases (Phase 7's `TableModel`). 9a through 9e need nothing that does not already exist, so the whole writing track can be pulled forward — and 9a on its own is useful for alphabet drilling the day it lands.
