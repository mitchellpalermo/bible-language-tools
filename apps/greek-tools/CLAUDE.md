# greek-tools — Claude Code Guide

## Project Overview

Greek vocabulary and grammar tools for New Testament Greek study. Built with Astro 5 + React 19, deployed to Cloudflare Pages. Routes are file-based under `src/pages/`; interactive features are React islands.

Key routes: `/` (home), `/flashcards`, `/quiz`, `/paradigms`, `/grammar`, `/parse`, `/parse/gnt`, `/reader`, `/daily`, `/keyboard`.

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
- **The flashcard session is `useFlashcardSession` from `@tools/shared`** (#87), shared with hebrew.tools. `Flashcards.tsx` owns the Greek card, the presets, POS filter and custom decks, the Levenshtein `checkAnswer` for typed answers, and the mapping onto `flashcard_*` PostHog events. Study All and Endless are drills that answer Missed / Got it and never write the schedule. Read the repo CLAUDE.md under "The flashcard session engine" and "Drill modes answer Missed / Got it" before changing how a session deals, grades or restarts.
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
`src/data/dailyVerses.ts` when it cannot. `src/data/dailyDose.ts` is the whole
integration. Things to know before changing it (#177):

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
  `dailyDose.test.ts` reads the real `_headers` and fails if it is missing.
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

## Architecture Decisions

See `docs/adr/` for recorded decisions:
- `001-analytics-posthog.md` — why PostHog over alternatives
- `002-github-issues-for-task-tracking.md` — why GitHub Issues replaced PRDs
- `007-posthog-first-party-ingest-host.md` — why events go through `t.greek.tools`, and the build guard that enforces it
