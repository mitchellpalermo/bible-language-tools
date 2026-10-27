# ADR 006: Client-only state defers to post-mount in hydrated components

## Status

Accepted. Amended 2026-10-27 — see the amendment at the end, which restates the rule and replaces its enforcement.

## Date

2026-10-22

---

## Context

Both apps server-render pages with Astro and hydrate interactive React components via `client:*` directives. During SSR, browser-only APIs (`localStorage`, `IndexedDB`, `window`, `navigator`, `matchMedia`) do not exist.

`SyncControls` (rendered `client:load` on `/account`) initialized state by reading `localStorage` during render (`useState(lastSyncedLabel)` → `getLastSyncedAt()`). The server rendered "Never synced"; clients with a prior sync rendered "Last synced …". React threw hydration error #418 on every mismatch — 31 captured exceptions in 30 days across 11 users on both sites, all on `/account`. (PostHog could not resolve the minified stack traces; see Issue #40 on source maps.)

---

## Decision

Components hydrated via `client:*` directives **must not read client-only state during render or state initializers**. Defer such reads to `useEffect` (e.g. `useState<string | null>(null)` + effect), so the first client render matches the SSR output. Reserve `client:only` for components with no meaningful SSR output.

---

## Consequences

**Positive:**
- Eliminates this class of hydration mismatch entirely
- Rule is mechanical and reviewable: any `localStorage`/`window`/`navigator` read outside `useEffect` (or an event handler) in a hydrated component is a bug

**Negative:**
- Storage-dependent labels show their default for one frame after mount (e.g. "Never synced" briefly before "Last synced 2 hours ago")
- Tests for such components must await post-mount state (`findByText`) rather than asserting synchronously

---

## Alternatives Considered

### `client:only` for storage-dependent components
Rejected as the default. It forfeits server rendering for the whole component — worse first paint and no SSR content — to fix what a one-line deferral fixes. Remains acceptable for components whose SSR output would be empty anyway.

### Suppress the hydration warning
Rejected. Masks real rendering bugs instead of fixing them.

---

## Amendment — 2026-10-27 (issue #167)

The review of the original fix pointed at five more components that read storage in a state initializer. Checking each one showed the rule above was both too broad and too weak.

**Too broad.** A storage read during render is harmless when nothing it returns reaches the *first* render. Both Flashcards pages read the SRS store and stats in an initializer, but the deck is dealt in an effect, so server and client both first draw the same empty state. Moving those reads into an effect would deal against an empty store, or deal twice and send `session_started` twice. `FocusPassageHub` and `FocusPassageVocab` are the same: they show "Loading…" until an effect has found the passage.

**Too weak.** "Any read outside `useEffect`" cannot be checked by grep. Reads hide inside `useMemo` (`WritingPractice` built its letter queue there), behind helper functions, and in initializers with nested generics that defeat a pattern. Four components that do reach the first render were still live:

| Component | Page | What differed |
|---|---|---|
| greek `ParadigmQuiz` | `/paradigms` | "Accents: on/off" text, and the density pill's highlight |
| hebrew `ParadigmQuiz` | `/paradigms` | The strict-pointing sentence, each table's "2 due" line, density |
| greek `FocusPassageList` | `/focus` | "No focus passages yet." against the student's list |
| hebrew `WritingPractice` | `/write` | Which letter comes first, or "Nothing due in this deck" |

None showed up in PostHog because static pages only began reporting on Oct 23–24, once their CSP allowed the analytics host (ADR 007). `/account` is server-rendered, so it was the one page reporting all along.

### The rule, restated

**The first client render must match the server's.** Reading storage is allowed anywhere that does not change that render.

- **Use `useStoredState(load, fallback, save?)`** from `@tools/shared/use-stored-state` for state seeded from storage. It returns the fallback during hydration and swaps in the stored value in a layout effect, which re-renders before the browser paints — so the one-frame flash listed under Consequences no longer happens. A component that mounts after hydration reads storage straight away.
- **Pass `save` rather than saving in an effect.** An effect that saves on change runs on mount with the fallback and writes it over the student's stored value. Both ParadigmQuiz components had exactly that effect.
- **Use the `loaded` flag, or `useHydrated()`, to hold back an empty state** that would be wrong for a returning student, such as "No focus passages yet."

### Enforcement

`hydrationErrors` (`@tools/shared/test/hydration`) renders a component to a string with storage hidden, seeds storage, hydrates, and returns every mismatch React reports. Each app's `src/test/hydration.test.tsx` runs it over every `client:load` island with a returning student's data, and fails when a page gains an island the test does not list. Each of the four components above failed it before its fix.

### Attribute mismatches are silent

React repairs nothing it finds different in an attribute during hydration, and warns only in development. A difference in `className`, `aria-checked` or `aria-pressed` alone never throws #418 — the page keeps the server's value until that prop next changes. A density-only difference in greek `ParadigmQuiz` would have left the wrong pill highlighted with no error anywhere. `hydrationErrors` catches it by reading React's development warning.
