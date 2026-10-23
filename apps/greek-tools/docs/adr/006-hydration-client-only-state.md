# ADR 006: Client-only state defers to post-mount in hydrated components

## Status

Accepted

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
