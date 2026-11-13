# greek-tools — Claude Code Guide

## Project Overview

Greek vocabulary and grammar tools for New Testament Greek study. Built with Astro 5 + React 19, deployed to Cloudflare Pages. Routes are file-based under `src/pages/`; interactive features are React islands.

Key routes: `/` (home), `/flashcards`, `/paradigms`, `/grammar`, `/parse`, `/parse/gnt`, `/reader`, `/daily`, `/keyboard`.

## Tech Stack

- **Framework:** Astro 5 + React 19 (islands architecture)
- **Styling:** Tailwind CSS v4
- **Runtime:** Cloudflare Pages (edge)
- **Analytics:** PostHog (see `docs/adr/001-analytics-posthog.md`)
- **Package manager:** pnpm

## Project Structure

```
src/
  components/     # React islands
  components/grammar/  # Grammar paradigm sub-components
  data/           # Domain data modules (vocabulary, grammar, SRS, etc.)
  lib/            # Pure logic (greek-input, paradigm-quiz, verb-parse, etc.)
  pages/          # Astro routes
  layouts/        # Astro layouts
  test/           # Shared test setup
scripts/          # Build-time data scripts (morphgnt, vocabulary)
public/           # Static assets and pre-built data files
e2e/              # Playwright end-to-end tests
docs/adr/         # Architecture Decision Records
```

## Commands

```bash
pnpm dev            # Start dev server at localhost:4321
pnpm build          # Build (runs data scripts first)
pnpm lint           # Biome lint check
pnpm lint:fix       # Biome lint + auto-fix
pnpm format         # Biome format (write)
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest (watch mode)
pnpm test:run       # Vitest (single run)
pnpm test:coverage  # Coverage report (must stay ≥ thresholds)
pnpm test:e2e       # Playwright e2e tests
```

## Code Style

Enforced by Biome (`biome.json`):

- Single quotes, 2-space indent, 100-char line width, trailing commas
- `noUnusedImports` and `noUnusedVariables` are errors
- `noExplicitAny` and `noConsole` are warnings (off in test files)
- `useExhaustiveDependencies` (React hooks) is a warning

Run `pnpm lint:fix` before committing. The pre-commit hook runs lint-staged automatically.

## Testing

Framework: Vitest + React Testing Library for unit/integration; Playwright for e2e.

### Coverage thresholds (enforced by `vitest run --coverage`)

| Metric     | Threshold |
|------------|-----------|
| Lines      | 90%       |
| Functions  | 90%       |
| Statements | 90%       |
| Branches   | 80%       |

Branches are at 80% (not 90%) due to defensive null-coalescing paths in grammar data types that are unreachable with valid production data.

### Test conventions

- Co-locate tests: `src/lib/foo.test.ts` next to `src/lib/foo.ts`
- Use `describe` blocks for grouping related cases
- Prefer `@testing-library/user-event` over `fireEvent` for simulated user interactions
- Test behavior, not implementation — avoid testing internal state directly
- Mock `localStorage` is pre-configured in `src/test/setup.ts`

### Currently excluded from coverage (TODO: add tests)

These components are excluded from coverage thresholds but should be tested:

- `src/components/GrammarReference.tsx`
- `src/components/GNTReader.tsx`
- `src/components/GreekText.tsx`
- `src/components/Transliteration.tsx`
- `src/data/morphgnt.ts`
- `src/lib/transliteration.ts`

When adding tests for these, remove them from the `coverage.exclude` list in `vitest.config.ts`.

### Writing new tests

Target 90% coverage on all new code. For new features, use the Kent Dodds Testing Trophy as a guide: favor integration tests over unit tests where possible.

## Task Tracking

Features are tracked as GitHub Issues (see `docs/adr/002-github-issues-for-task-tracking.md`). Use `/fix-issue <N>` to implement an issue. Always use `closes #N` in commit messages to auto-close on merge.

## Greek Domain Notes

- Greek input uses a Beta Code–style mapping (`src/lib/greek-input.ts`): ASCII keys produce Greek characters
- Word-final σ is automatically converted to ς (`applyFinalSigma`)
- Morphological data comes from MorphGNT, pre-processed by `scripts/build-morphgnt.mjs` into `public/data/`
- Vocabulary data is pre-processed by `scripts/build-vocabulary.mjs`
- SRS (Spaced Repetition System) state is persisted in `localStorage` via `src/data/srs.ts`
- Flashcard display preferences are persisted separately (`greek-tools-flashcard-display-v1`, `src/lib/flashcard-settings.ts`, over `@tools/shared/flashcard-settings`). Today that is one boolean: whether the part of speech appears on the front of a flashcard, which defaults to off. See the repo CLAUDE.md under "What the card front gives away".
- **The flashcard session is `useFlashcardSession` from `@tools/shared`** (#87), shared with hebrew.tools. `Flashcards.tsx` owns the Greek card, the presets, POS filter, custom decks and textbook chapter decks (#228, below), the Levenshtein `checkAnswer` for typed answers, and the mapping onto `flashcard_*` PostHog events. Study All and Endless are drills that answer Missed / Got it and never write the schedule. Read the repo CLAUDE.md under "The flashcard session engine" and "Drill modes answer Missed / Got it" before changing how a session deals, grades or restarts.
- **Syncretic parses are correct on every facet.** Several case/number/gender combinations share one spelling (participle acc. sg. masc. = acc. sg. neut. in 2-1-2 forms, nom./acc. sg. neut. everywhere, and so on). Grading compares a student's (case, number, gender) against every triple the form could carry, via `PARTICIPLE_SYNCRETISMS` and `acceptedParticipleParses` in `src/lib/gnt-parse.ts`. Never compare a participle facet with strict equality on its own: that marks a legitimate reading wrong (issue #46). Identities that hold in only one declension class take an `endsIn` gate, and an identity the gate cannot separate (fem. gen. pl. in 3-3 participles) is left out.

## Loading book data in a component

`fetchBook(code)` is async and the book codes differ wildly in size — `REV.json`
is roughly fifty times `PHM.json`. Any effect that fetches a book **must** guard
against a superseded response landing last:

```tsx
useEffect(() => {
  let cancelled = false;
  fetchBook(book)
    .then((data) => {
      if (!cancelled) setBookData(data);
    })
    .catch(console.error);
  return () => {
    cancelled = true;
  };
}, [book]);
```

Two fetches overlap more often than it looks. A page that mounts on a default
book and then switches — the export page reads `?ref=` in an effect, so its
first render always fires a fetch for `DEFAULT_BOOK` — has both in flight at
once, and whichever resolves last wins. That is how the export page capped
Philemon at 20 verses: Revelation 1's verse count, arriving after Philemon's.

Where the fetched data drives what the user can *choose* (option lists, ranges,
counts), also pair the data with the code it was loaded for and derive from it
only when the codes match, as `CrossChapterSelector` does. The cancellation flag
stops the wrong data from being stored; pairing stops the previous book's data
from being read during the window before the new fetch resolves.

Mock `fetchBook` per code when testing this — a mock that returns the same stub
for every book cannot tell a stale response from a fresh one, and the original
`CrossChapterSelector` tests missed the bug for exactly that reason.

## The Daily Dose source (`/daily`)

`/daily` shows the newest Greek verse lesson from Daily Dose of Scripture
(formerly Daily Dose of Greek) and falls back to the curated list in
`src/data/dailyVerses.ts` when it cannot. The fetch, timeout, cache, entity
decoding and title scanning are `@tools/shared/daily-dose`, shared with
hebrew.tools' `/daily`; `src/data/dailyDose.ts` binds it to the Greek category
and the 27 NT book names. A change to how the feed is read belongs in the shared
module and reaches both apps. Things to know before changing it (#177):

- **The fallback is designed to look normal, so it hides a broken source.** The
  rebrand left the old feed answering with stale posts, and the page showed the
  wrong verse for weeks without an error. `daily_verse_viewed` now carries
  `source` (`daily_dose` or `curated`) and, on a fallback, `fallback_reason`.
  Check that ratio in PostHog after any change here, on the static `/daily`
  page. Same failure pattern as the PostHog host incident in the repo CLAUDE.md.
- **Look the category ID up; never guess it.** Greek is category 43 on
  dailydoseofscripture.com (`/wp-json/wp/v2/categories?slug=greek`). The old
  Greek ID, 5, is Aramaic on the new host, so a host swap alone would serve
  Aramaic lessons that fail to parse.
- **The newest Greek post is often not a verse.** Special editions, interviews
  and event notices share the category, most Saturdays among them. The fetch
  takes 10 posts and uses the first title that parses as one Greek NT
  reference. On a Saturday or Sunday that is Friday's lesson, which is
  intended. Hebrew, Aramaic, Latin and Septuagint lessons live in other
  categories, and an OT book name never parses anyway.
- **`title.rendered` is HTML.** WordPress writes `&#8211;` for a dash and
  `&amp;` for `&`, so titles are entity-decoded before matching.
- **The API origin must be in `connect-src` in `public/_headers`.** A missing
  host fails as a bare network error, which is just another quiet fallback.
  `dailyDose.test.ts` reads the real `_headers` through `cspAllowsDailyDose`,
  which reads only `Content-Security-Policy:` lines. Its first version searched
  the whole file for `connect-src` and would have matched a comment.
- `src/data/fixtures/daily-dose-greek-feed-2026-10-24.json` is a saved copy of
  the real response, taken on a Saturday when a special edition was on top.

## Error Reporting

Two mechanisms capture runtime errors and send them to PostHog:

**Automatic JS errors** — `capture_exceptions: true` in the PostHog init (`src/layouts/Layout.astro`) hooks into `window.onerror` and `unhandledrejection`. Any unhandled error on the page is sent automatically as a `$exception` event. No extra code needed.

**React ErrorBoundary** — `src/components/ErrorBoundary.tsx` is a class component that calls `posthog.captureException` in `componentDidCatch`. Every React island wraps its content using the Inner/wrapper pattern:

```tsx
function FlashcardsInner() { /* all the real logic */ }

export default function Flashcards() {
  return (
    <ErrorBoundary component="Flashcards">
      <FlashcardsInner />
    </ErrorBoundary>
  );
}
```

The `component` prop is tagged on every captured exception so errors can be filtered in PostHog by which island originated them.

**Why the Inner/wrapper pattern?** Astro islands each create their own `ReactDOM.createRoot()`. A boundary placed outside a `client:load` island in an `.astro` file is in a different React tree and cannot catch errors from that island. The boundary must live inside the component's own tree.

**When adding a new React island**, follow the same pattern: implement as `ComponentNameInner`, export `ComponentName` as the ErrorBoundary wrapper with the component name as the `component` prop.

**Viewing errors in PostHog** — errors appear under "Error tracking" in the PostHog sidebar, grouped by message and stack trace, with links to session recordings. Filter by the `component` property to isolate errors to a specific island.

## Textbook chapter decks (#228)

`/flashcards` has a **Textbook** row: one chip per textbook, and under the
active one a chapter picker. Today there is one book, Merkle and Plummer,
*Beginning with New Testament Greek*, used with Dr. Plummer's permission (Nov
2026). The queries, the stored selection and the picker are shared with
hebrew.tools (repo CLAUDE.md, "Textbook chapter decks").

| File | What it holds |
|---|---|
| `src/data/textbook-chapters.ts` | Each book's map, chapter number to lemmas, and its headwords with no card |
| `src/data/textbooks.ts` | The book list (`BOOKS`, `TEXTBOOK_IDS`, `TEXTBOOKS`), the join to the vocabulary (`chaptersOf`) and the bound queries |
| `src/lib/deck-selection.ts` | The stored selection, `greek-tools-deck-v1`. Local, never synced |
| `src/components/TextbookDecks.tsx` | The chip row and the picker |

- **Only the chapter assignments come from the book.** A map is lemmas and
  chapter numbers. Glosses, parts of speech and frequencies are
  `vocabulary.ts`'s (MorphGNT and Dodson). Do not add a textbook's gloss,
  cognate, mnemonic or prose anywhere in the repository, and do not commit the
  source document or an extract of it. `textbook-chapters.test.ts` fails on any
  map entry that is not Greek letters.
- **The tag is a lookup, not a field.** `vocabulary.ts` is generated and is not
  touched. `chaptersOf(word)` reads the maps by the word's `greek` field, so a
  lemma is spelled as the vocabulary spells it (`'ὁ, ἡ, τό'`, `'ἐκ, ἐξ'`).
- **To add a textbook:** add its map to `textbook-chapters.ts` and its entry to
  `BOOKS` in `textbooks.ts`. The chip, the grid, the counts and the stored
  selection follow. An id is stored in the student's selection: never rename one.
- **Section numbers map to chapters by the number before the point.** The source
  heads each list "1.11", "2.12" and so on: chapter 1 section 11, chapter 2
  section 12. The list runs to chapter 23, fifteen headwords a chapter.
- **A headword with no vocabulary entry is left out and listed**, with a reason,
  in `BEGINNING_GREEK_UNRESOLVED`: ἱερόν and δεῖ (MorphGNT files them under
  ἱερός and δέω) and the phrase ἐὰν μή. So 342 of 345 have cards. A test fails
  if the vocabulary gains one of them, which is the signal to move it into the map.
- **How it sits with the other controls.** A custom deck, while on, is the deck;
  the textbook waits behind it. Choosing a textbook switches the custom deck
  off. The frequency band does not narrow a chapter (the default band would
  empty most of them), so the Preset row and the Frequency chips are hidden
  while a textbook is on. The part-of-speech filter does narrow it, as it does a
  custom deck.
- **The session restarts on the textbook and its chapters, by value**
  (`restartKey`). Picking what is already picked keeps the session.
- **Today's Session does not take the selection.** It deals due vocabulary
  whatever deck is open. The paradigm quiz and the parse quizzes have no
  vocabulary deck to narrow.
- **The selection is read through `useStoredState`**, so the first render is the
  default on both sides, and it is seeded in `src/test/hydration.test.tsx`.
- **The custom-deck half of `DeckSelection` is unused here** until the decks
  move onto the shared store (#242). A stored `deck: 'custom'` reads as no
  textbook.

## Parse history and the shared attempt log (#209)

Parse history is a per-passage `{ correct, total }` pair (`greek-tools-focus-parse-v1`),
and **it is still what syncs**, in `/api/progress`. The shared attempt log has a
Greek binding (`src/lib/attempt-log.ts`, key `greek-tools-attempts-v1`) that is
device-local until #200 adds the account endpoint.

- **Record a session through `recordParseResults`**, which updates the totals and
  logs one attempt per answer (`parse/passage/<id>`). Calling `recordParseSession`
  alone leaves the log short; the two must not drift.
- **Old totals read as attempts through `parseHistoryAsAttempts`** (`src/lib/parse-attempts.ts`):
  read-only, deterministic ids `legacy-parse-<passage>-<n>`, `at: 0`, and never
  counting an answer that is already in the log. Do not write the synthetic
  attempts into the log: they would be counted again on the next read.
- **Deleting a passage clears its attempts too** (`deletePassage`). Any new store
  keyed by passage id needs the same line.
- **Known limit, unchanged:** `mergeParseHistory` takes the higher total per
  passage, so sessions parsed on two devices between syncs are not added. The
  fix is syncing the attempt log (a union by id), not changing this rule.
- **What is not duplicated:** SRS cards and stats merge in `@tools/shared/sync-merge`
  (re-exported by `src/lib/sync-merge.ts`); quiz and flashcard settings are
  `createQuizSettings` / `createFlashcardSettings` bindings; the daily verse
  streak is `createDailyStreak`. Decks, focus passages and parse-history totals
  are greek-only merges with no shared counterpart.

## The paradigm ladder (#199)

The **Ladder** tab on `/paradigms` orders 23 tables by difficulty — the article,
the nouns, the adjectives and the present active participle read as a noun, three
pronouns, then the verb (active before middle and passive) — and opens each after
two clean writes of the one below. The unlock rule, the locked-rung list and its
"Open anyway" button are `@tools/shared/ladder` (see the repo `CLAUDE.md`, "The
paradigm ladder"); this app supplies the rungs and the grading.

| File | What it owns |
|---|---|
| `src/data/paradigm-ladder.ts` | The rungs, in order. A rung id is a `TableModel` id, so **never rename a table id** (`noun-2m-os`): progress is stored under it |
| `src/lib/paradigm-ladder.ts` | The storage binding (`greek-tools-paradigm-ladder-v1`), `ladderOutcome` and the results sentence |
| `src/lib/greek-input.ts` | `isExactAnswer`, the ladder's grading |
| `src/data/paradigm-ladder.test.ts` | Every rung's forms against the Greek New Testament |

Rules worth keeping:

- **A clean write is exact in letters, breathings and iota subscripts, always; in accent marks only when Accents is on.** `stripDiacritics` (used by the quiz's "accent-only" result) removes breathings and iota subscripts too, so on its own it would pass ἡμέρα for the dative ἡμέρᾳ. The ladder uses `stripAccentMarks`, which removes only acute, grave and circumflex. The accent rule follows the student's own Accents setting because Greek courses commonly do not test accents (#198 was closed for that reason), and an accent-off student is told so on the results screen. The quiz's own Accents-off scoring still ignores breathings and subscripts; that is existing behaviour, not changed here.
- **Any checked write of a rung's table counts**, from the Ladder tab or the table's own category tab. Only Full Recall (every cell blank) counts; a peek (the hint button) voids the write and logs nothing.
- **Every answer is logged** to the attempt log as `paradigm/<table id>/r<row>c<column>` (row and column positions in the table). Renaming a table id or reordering its rows splits that history. A peeked attempt logs nothing. The log is still device-local until #200.
- **Sync is `ladderProgress` in `/api/progress`**, rows in `ladder_progress` with `language = 'greek'` (no migration: the table and its primary key already allow it). The greek `PUT` is a full replace, but **the ladder is merged server-side** with the account's rows by the larger count, so a session-end push from a device that is behind, or from a page that predates the ladder (no `ladderProgress`), can never lower a rung. `DELETE` clears it, and the account reset keeps it in this browser and pushes it back.
- **The verb rungs cannot be checked form by form.** λύω is a model verb and most of its forms are not in the text, so the test splits each form into the stem and what follows and requires that tail to end an attested word of the same person, number, tense, voice and mood. That vouches for endings and formatives, not for stems, augments, reduplication or accents. The noun, adjective, article and pronoun rungs are looked up by lemma, case, number and gender; what the text lacks is named in `UNATTESTED`, and a second test fails if a listed form turns out to be attested.
- **The corpus is gitignored.** `pnpm --filter greek-tools exec node scripts/build-morphgnt.mjs` builds it; CI does so before the tests, and `src/test/corpus.test.ts` fails there if it is missing, so the checks cannot quietly skip.
- **A Greek instructor still needs to review** the order and the forms the corpus cannot vouch for (see the PR for the list).

## Today's Session (#197)

`/today` runs one session sized to a time budget (20, 45 or 90 minutes): due
vocabulary, then one drill, ending on a summary. The queue builder, the clock,
the summary card and the study streak are shared (`@tools/shared/today`,
`@tools/shared/study-streak`, `components/TodaySession`); the repo CLAUDE.md
"Today's Session" has the rules. What is specific here:

| File | What it holds |
|---|---|
| `src/lib/today.ts` | Due vocabulary, the drill providers and rotation, estimates, `dueTomorrow`, the budget preference |
| `src/components/TodaySession.tsx` | The page: plan preview, the run, the summary |
| `src/components/VocabCard.tsx` | The flashcard face, shared by `/flashcards` and Today |
| `src/lib/study-streak.ts` | `createStudyStreak('greek-tools-study-streak-v1')`; **synced**, kept by the account reset |

- **Vocabulary is due only**: no new words, no weak ones. Due means every card the
  schedule says is due, whatever deck or frequency band `/flashcards` has open.
- **There is no paradigm section.** The paradigm quiz schedules no cells, so
  nothing is "due" there. Do not invent a schedule for it here; the ladder (#199)
  is where paradigms join Today.
- **Parse history has no due date**, so it is never a tier. It enters two ways:
  the parse drill asks about the tense-voice-mood kinds the attempt log says are
  missed (`parse/paradigm/<tense>-<voice>-<mood>`, written by the drill through
  `logAttempts`), and the plan and summary name the focus passage parsed worst
  (`weakestPassage`, reading old totals through `parseHistoryAsAttempts`).
  Passage answers cannot be mapped to a kind of form, so they only feed the hint.
- **The drill rotates by day among `DRILL_PROVIDERS`**: the parse quiz and a mixed
  review (learned words that are not due, answered Missed / Got it, never
  scheduled). **The seam for the ladder (#199):** add a `ladder` provider, a
  `{ kind: 'ladder' }` variant to `TodayDrill` and a branch in `planSteps`; `ladder`
  is already in `DRILL_ROTATION`, and a test pins that it is the only kind
  without a provider. There is deliberately no accent-trainer seam (#198 was closed).
- **The study streak syncs** on two columns of `study_stats`. `PUT /api/progress`
  replaces that row, so `putProgress` merges the incoming streak with the stored
  one first. `DELETE` clears it with the rest of the row, and the account reset's
  follow-up push restores it from this browser.
- **The attempt log still does not sync** (#200), so the parse drill's history is
  per device for now.

## Architecture Decisions

See `docs/adr/` for recorded decisions:
- `001-analytics-posthog.md` — why PostHog over alternatives
- `002-github-issues-for-task-tracking.md` — why GitHub Issues replaced PRDs
- `006-hydration-client-only-state.md` — why an island's first render must not depend on storage, and the test that enforces it (governs both apps)
- `007-posthog-first-party-ingest-host.md` — why events go through `t.greek.tools`, and the build guard that enforces it
- `008-cross-device-study-history.md` — why the attempt log and ladder progress sync for signed-in students (governs both apps; hebrew.tools first)
