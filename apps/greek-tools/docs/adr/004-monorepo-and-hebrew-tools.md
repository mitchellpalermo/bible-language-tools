# ADR 004: Monorepo Structure and hebrew.tools Expansion

## Status

Accepted

## Date

2026-06-08

---

## Context

greek.tools is currently a single Astro app in its own repository. A counterpart app, hebrew.tools, is planned that mirrors much of the same functionality: vocabulary flashcards with spaced repetition (SRS), a morphological text reader, daily verse, grammar reference, and paradigm practice — applied to Biblical Hebrew rather than Koine Greek.

Both apps will be hosted on Cloudflare Pages. The accounts and cross-device sync infrastructure described in ADR 003 is being implemented now, before hebrew.tools development begins. Two structural decisions must be made before that infrastructure work starts:

1. **Should the two apps share a codebase (monorepo) or live in separate repositories?**
2. **Should users have one account that works across both apps, or separate accounts per app?**

These decisions are coupled: shared auth is much easier to build and maintain if both apps are in the same repository with shared packages.

---

## Decision

### Monorepo with pnpm workspaces

The two apps will share a single repository structured as a pnpm workspace monorepo:

```
apps/
  greek-tools/      # existing app, moved from repo root
  hebrew-tools/     # new app, same Astro + React + Cloudflare stack
packages/
  db/               # shared Drizzle schema and migrations
  auth/             # shared Better Auth configuration and Astro middleware
  sync/             # shared ProgressPayload types and merge logic
```

Each app retains its own `wrangler.jsonc`, its own Cloudflare Pages project, and its own domain. Build and test commands run per-app or across the workspace via pnpm's `--filter` flag. Turborepo is not introduced unless build graph complexity warrants it.

### Shared auth, per-language progress

Users have one account that works on both greek.tools and hebrew.tools. The `users` and `sessions` tables are shared. Progress data (SRS cards, study stats, custom decks) is per-language — stored in namespaced tables or with a `language` discriminator column — and never crosses apps.

The `ProgressPayload` type defined in ADR 003 gains a `language: 'greek' | 'hebrew'` field. The `GET /api/progress` and `PUT /api/progress` endpoints are scoped by the authenticated user and the calling app's language identifier.

### One shared Cloudflare D1 database

A single D1 database holds all tables for both apps. The `packages/db` package owns the Drizzle schema and all migrations. Each app's `wrangler.jsonc` references the same D1 binding name. This is viable because the data volume is small (a few thousand SRS card rows per user across both apps) and because splitting the database would undermine shared auth.

### Timing: restructure before implementing accounts

The monorepo migration happens before Phase 1 of the accounts work (ADR 003). Implementing auth inside the current single-app structure and then extracting it to a shared package later would require two migrations at the cost of one. The cheapest window to go monorepo is now, before any shared infrastructure exists.

---

## Hebrew-specific technical considerations

These are not decisions but known constraints that will shape hebrew.tools development. Recorded here so future sessions do not have to rediscover them.

**Right-to-left (RTL) text rendering.** The reader, flashcard, keyboard, and grammar reference UIs all require `dir="rtl"` support. Any component added to `packages/ui` must be built with CSS logical properties (`margin-inline-start`, `padding-inline-end`, etc.) from the start. Tailwind CSS v4 supports logical property utilities (`ms-`, `me-`, `ps-`, `pe-`). Components that hard-code `ml-`/`mr-` directional utilities will need to be updated before they can be used in hebrew.tools.

**Input system.** The Greek Beta Code keyboard (`src/lib/greek-input.ts`) does not transfer. Hebrew input requires a separate system: a standard OS Hebrew keyboard layout plus a custom nikud (vowel point) input layer. This is a new design problem with no reusable code from greek.tools.

**Morphological data source.** MorphGNT is replaced by the OpenScriptures Hebrew Bible (morphhb) or the ETCBC Hebrew Bible (BHSA) — both have different data formats and different licensing terms. The `scripts/build-morphgnt.mjs` pipeline does not transfer; a `build-morphhb.mjs` equivalent must be written. The data model in `src/data/morphgnt.ts` will have a Hebrew counterpart with different parse code conventions.

**Pointed vs. unpointed text.** Greek always displays diacritics. Hebrew has a pedagogical choice: show nikud (vowel points) or not. This affects the SRS card data model, answer-checking logic, the reader UI, and the keyboard. The decision must be made before the data pipeline is built because it shapes the canonical lemma format.

**Word key normalization.** `normalizeKey()` in greek.tools strips compound lemma forms (e.g., `ὁ, ἡ, τό` → `ὁ`). Hebrew roots and binyanim (verb conjugation patterns) have different canonical lemma conventions depending on the morphological dataset chosen. A Hebrew-specific normalization function is required.

**Answer checking.** The Levenshtein distance + diacritic-stripping logic in the Flashcards component is Greek-specific. Hebrew will need an equivalent that understands nikud stripping vs. consonantal comparison.

---

## What is shared between the apps

| Layer | Shared as-is | Shared with adaptation | Not shared |
|-------|-------------|----------------------|------------|
| Auth | Better Auth config, middleware, session types | — | — |
| Database | `users`, `sessions` tables; Drizzle `db()` helper | Progress tables (same shape, different language namespace) | — |
| Sync | `ProgressPayload` type, merge logic, `syncManager` | Language discriminator on payload | — |
| SRS algorithm | SM-2 core logic, `SRSCard` interface, streak logic | `normalizeKey()` (language-specific impl) | — |
| UI | `ErrorBoundary`, layout shell, nav | `GreekText`/`HebrewText` (RTL-aware rewrite) | Keyboard, grammar reference content |
| Data pipeline | Build script pattern (fetch → transform → JSON) | Parse code decoder (language-specific) | MorphGNT fetcher, vocabulary dataset |
| Tooling | Astro config shape, Biome config, Vitest config, wrangler config shape | Per-app environment variables | — |

---

## Consequences

**Positive:**
- Auth and sync infrastructure is written once and tested once; both apps inherit it
- A user studying both Greek and Hebrew has one account and one login
- `packages/sync` merge logic is pure TypeScript with no app-specific dependencies — fully testable in isolation
- Shared Drizzle schema means one migration pipeline; schema drift between apps is impossible
- RTL-awareness constraint on shared components is easier to enforce from a single codebase than across two repos

**Negative:**
- Monorepo migration adds setup overhead before any feature code can be written — approximately one week before Phase 1 of ADR 003 can begin
- hebrew.tools introduces substantial new engineering problems (RTL, input system, morphological data) that have no reusable solution from greek.tools; the shared infrastructure reduces duplication but does not reduce the Hebrew-specific design work
- A shared D1 database means a bad migration affects both apps simultaneously; migration discipline is more critical than in a single-app setup
- pnpm workspace builds require discipline around internal package versioning and import paths; `packages/*` consumers must use workspace protocol (`"@greek-tools/db": "workspace:*"`)

---

## Alternatives Considered

### Separate repositories

Each app lives in its own repo with no shared code. Auth and sync would be re-implemented independently in hebrew.tools.

Rejected because: it foregoes the primary benefit of going monorepo — shared auth. Building two auth systems and merging or federating them later is significantly more expensive than building one shared system now. The data volume and team size (one developer) do not create any isolation benefit that justifies the duplication cost.

### Separate user accounts per app

Users register separately on greek.tools and hebrew.tools. No shared identity layer.

Rejected because: a user studying both languages would maintain two separate accounts, two separate streaks, and two separate study histories with no connection between them. This is a UX cliff that discourages cross-tool use. The shared auth implementation cost is low relative to the permanent UX debt of separate accounts.

### Defer monorepo until hebrew.tools development begins

Keep greek.tools as a single-app repo, implement accounts there, and restructure into a monorepo when hebrew.tools work starts.

Not rejected outright — this is a legitimate tradeoff if hebrew.tools is more than 12–18 months away. The cost is a refactor of the auth and sync packages out of `greek-tools/src/` when the time comes. Recorded here so the decision can be revisited if the hebrew.tools timeline slips significantly.

### Turborepo for task orchestration

Add Turborepo on top of pnpm workspaces for caching and parallelized builds.

Deferred — not rejected. Turborepo adds value when the build graph is complex enough to benefit from caching. At two apps and three shared packages, pnpm's `--filter` flag is sufficient. Revisit if build times become a problem.
