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

## Phase 1 — Foundation: Hebrew Keyboard

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
- By vocabulary source (e.g., "Pratico & Van Pelt Ch. 1–5")

**Direction modes:**
- Hebrew → English gloss (same as Greek → English)
- English → Hebrew (typing Hebrew requires the Keyboard tool — consider linking them)
- Transliteration → Hebrew (useful early in the curriculum)

**localStorage keys (new namespace):**
- `hebrew-tools-srs-v1` — SRS card store
- `hebrew-tools-stats-v1` — study stats

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

Unlike greek.tools (which uses a hand-curated 50-word vocabulary as the gloss source), the Hebrew Bible Reader needs glosses for the full Hebrew vocabulary (~8,000 unique lemmas). Options:

1. **BDB (public domain):** Brown-Driver-Briggs Hebrew Lexicon — scanned/digitized versions exist; no clean machine-readable form without cleanup work
2. **OpenHebrew / STEPBible TIPNR:** STEPBible project provides open-licensed lemma → gloss mappings — best option for machine-readable glosses
3. **OSHB embedded glosses:** The OSHB XML includes Strong's definitions — sufficient for a first version
4. **Hand-curated for top-frequency words:** Same approach as greek.tools — start with the top 500 words and expand

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

### OSHB data pipeline
- Source: `https://github.com/openscriptures/morphhb` (XML per book)
- Build script (analog to `scripts/build-morphgnt.mjs`): fetch XML → parse → output `public/data/morphhb/{BOOK}.json`
- Book codes: GEN, EXO, LEV, NUM, DEU, JOS, JDG, RUT, 1SA, 2SA, 1KI, 2KI, 1CH, 2CH, EZR, NEH, EST, JOB, PSA, PRO, ECC, SNG, ISA, JER, LAM, EZK, DAN, HOS, JOL, AMO, OBA, JON, MIC, NAH, HAB, ZEP, HAG, ZEC, MAL
- Full Hebrew Bible: 39 books (~305,000 words)

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

| Phase | Feature | Complexity | Dependency |
|-------|---------|------------|------------|
| 1 | Hebrew Keyboard | Medium | None |
| 2 | Vocabulary Flashcards | Low (logic ports directly) | Phase 1 (for typing mode) |
| 3 | Daily Verse | Medium | OSHB data pipeline |
| 4 | Hebrew Bible Reader | High | OSHB data pipeline |
| 5 | Transliteration | Medium | None |
| 6 | Grammar Reference | High (content-heavy) | None |
| 7 | Paradigm Quiz | Medium (ports from greek.tools) | Phase 1, Phase 6 |
| 8A | Root Lookup | Medium | Phase 4 data |
| 8B | Parsing Practice | Medium | Phase 4 data |
| 8C | Binyan Guide | Low (content) | None |

The OSHB data pipeline (needed for Phases 3 and 4) is the most important early investment — it unblocks the two highest-value features.
