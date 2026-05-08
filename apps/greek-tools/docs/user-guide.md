# greek.tools User Guide

greek.tools is a free, browser-based toolkit for students learning Koine Greek. Everything runs locally in your browser — no accounts, no sign-ups, and your progress is saved automatically on your device.

---

## Tools Overview

### Greek Keyboard

Type polytonic Greek using your standard English keyboard with Beta Code input. Letters map directly — type `a` for α, `b` for β, `g` for γ, and so on. Add diacritical marks after the vowel:

| Key | Mark |
|-----|------|
| `)` | smooth breathing |
| `(` | rough breathing |
| `/` | acute accent |
| `\` | grave accent |
| `=` | circumflex |
| `|` | iota subscript |

Final sigma (ς) is applied automatically at word boundaries — just type `s` and the app handles the rest. A full mapping reference is available on the page. Use the **Copy** button to grab your Greek text for use anywhere.

### Vocabulary Flashcards

Study the most common Greek New Testament (GNT) vocabulary with built-in spaced repetition. Cards are scheduled using the SM-2 algorithm, so words you struggle with appear more often, and words you know well space out over time.

**Settings you can adjust:**

- **Direction** — Study Greek → English or English → Greek
- **Answer mode** — Flip to reveal, or type your answer
- **Frequency filter** — Focus on words that appear 500+ times, 100–499 times, 50–99 times, or fewer than 50
- **Part of speech** — Filter by noun, verb, adjective, conjunction, and more

In flip mode, use **Space** to reveal the answer, then **Right Arrow** for "Got It" or **Left Arrow** for "Still Learning." In type mode, answers are checked with fuzzy matching so minor typos won't count against you.

Your study streak tracks consecutive days where you review at least 10 cards. Stats including accuracy and total reviews are tracked automatically.

### Daily Verse

A new Greek verse appears each day, cycling through 66 curated pedagogical passages from across the New Testament. Visit daily to build a reading streak.

- Toggle **Show Glosses** to display English definitions beneath each word
- Click any word to see its lemma, definition, morphological parse, and GNT frequency
- Use the **Open Chapter** link to jump into the full Reader at that passage

### GNT Reader

Read the Greek New Testament chapter by chapter. Select a book and chapter from the toolbar, or navigate with the Previous/Next arrows.

- Click any word for a popup showing its dictionary form, English gloss, full morphological parse, and how often it appears in the GNT
- Toggle **Show Glosses** to display inline English definitions beneath each word
- Words you've already studied in Flashcards are marked with a dotted underline
- Use the **Study in Flashcards** button in any word popup to add it to your study rotation

The Reader remembers where you left off. The homepage Reader card links directly to your last-read passage.

**Direct links:** Share or bookmark specific passages using URL parameters like `greek.tools/reader?ref=JHN.3.16`.

### Transliteration

Convert between Greek text and the Society of Biblical Literature (SBL) romanization scheme. The tool works in both directions:

- Type or paste Greek on the left to see the SBL transliteration on the right
- Type SBL romanized text on the right to generate Greek on the left (unaccented)

A reference table of the full SBL scheme is included on the page. Use the **Copy** buttons to grab either version.

### Grammar Reference

An interactive reference covering the major paradigms of Koine Greek, organized into eight sections:

- **Nouns** — 1st, 2nd, and 3rd declension paradigms with articles
- **Adjectives** — 2-1-2 and 3-1-3 patterns
- **Verbs** — Present, Imperfect, Future, Aorist, Perfect, and Pluperfect across Active, Middle, and Passive voices in Indicative, Subjunctive, and Imperative moods
- **Contract Verbs** — Contraction rules and paradigms for α, ε, and ο stems
- **Liquid Verbs** — Future and Aorist patterns with comparison to standard forms
- **Pronouns** — 1st, 2nd, and 3rd person with gendered forms
- **Prepositions** — 60+ entries with case governance and English glosses
- **Accent Rules** — Placement patterns and exceptions

Use the **Endings** toggle to switch between full forms (with articles) and endings only. Click any cell in a paradigm table for a grammatical description. On mobile, use the **Sg/Pl** toggle to view one number at a time for wider tables.

### Paradigm Quiz

Test your paradigm knowledge with fill-in-the-blank drills. Choose from noun declensions, adjective patterns, or verb conjugations.

**Settings:**

- **Difficulty** — Easy (25% blank), Medium (50% blank), or Hard (100% blank for full recall)
- **Accent grading** — Strict mode marks accent errors; lenient mode ignores them

Type your answers using Beta Code (the same input system as the Greek Keyboard). After submitting, cells are color-coded: green for correct, yellow for accent-only errors, and red for incorrect. The correct forms are shown so you can compare.

---

## Tips

- **Build a daily habit** — Visit the Daily Verse page each day to maintain your reading streak, then open the full chapter in the Reader to keep going.
- **Use the Reader and Flashcards together** — When you encounter an unfamiliar word in the Reader, click it and hit "Study in Flashcards" to add it to your spaced repetition rotation. Words you've studied show a dotted underline in the Reader so you can track your progress.
- **Start with high-frequency words** — Use the frequency filter in Flashcards to focus on words that appear 500+ times first, then work down. These words make up the vast majority of the GNT text.
- **Quiz yourself on paradigms** — After reviewing a paradigm in the Grammar Reference, switch to the Paradigm Quiz and select the same pattern to test your recall.
- **Bookmark passages** — Use direct URLs like `greek.tools/reader?ref=ROM.8` to bookmark chapters you're working through.

---

## Data and Privacy

All your progress — flashcard history, reading position, streaks, and study stats — is stored locally in your browser using localStorage. Nothing is sent to a server. If you clear your browser data, your progress will be reset.

greek.tools uses the MorphGNT dataset, which provides morphologically tagged text of the Greek New Testament based on the SBL Greek New Testament (SBLGNT).
