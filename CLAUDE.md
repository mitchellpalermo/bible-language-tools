# bible-language-tools

Monorepo for [greek.tools](https://greek.tools) and [hebrew.tools](https://hebrew.tools) — biblical language learning apps built with Astro 5, React 19, Tailwind 4, and Cloudflare Pages.

## Structure

```
apps/
  greek-tools/   — greek.tools (production, all 8 features complete)
  hebrew-tools/  — hebrew.tools (in development, see ROADMAP.md)
packages/
  shared/        — language-agnostic utilities shared by both apps
```

## Running the apps

```bash
pnpm install            # install all workspace dependencies from repo root

pnpm dev:greek          # start greek-tools dev server
pnpm dev:hebrew         # start hebrew-tools dev server

pnpm build:greek        # build greek-tools for production
pnpm build:hebrew       # build hebrew-tools for production

pnpm test               # run all tests across all packages
pnpm typecheck          # typecheck all packages
```

To work on a single app directly:

```bash
cd apps/greek-tools
pnpm dev
pnpm test:run
pnpm typecheck
```

## packages/shared

Contains logic that both apps use. Import via the `@tools/shared` workspace package:

```typescript
import { newCard, nextSRS, recordReview } from '@tools/shared/srs';
import { createQuizSettings } from '@tools/shared/quiz-settings';
import NumberToggle from '@tools/shared/components/NumberToggle';
```

### What's in shared

| Export | Description |
|--------|-------------|
| `@tools/shared/srs` | SM-2 spaced repetition algorithm, types, and pure stats functions |
| `@tools/shared/quiz-settings` | `createQuizSettings(storageKey)` factory for persisting quiz difficulty |
| `@tools/shared/nav` | `NavLink` type and the active-route predicates the nav renders with |
| `@tools/shared/nav-menu` | `initNavMenu()` — DOM controller for the mobile drawer |
| `@tools/shared/ink` | Stylus writing engine — stroke capture, palm rejection, smoothing, variable-width rendering, geometric scoring, and the `ScriptPack` type |
| `@tools/shared/components/InkCanvas` | The writing surface (React) |
| `@tools/shared/components/SiteNav.astro` | The site navigation for both apps (see below) |
| `@tools/shared/components/NumberToggle` | Sg/Pl pill toggle (mobile only) |
| `@tools/shared/components/EndingsToggle` | Full forms / Endings only toggle |
| `@tools/shared/components/SectionHeading` | Anchor-linked section heading |
| `@tools/shared/components/DescriptionBar` | Hover description bar for paradigm tables |

### Adding to shared

Only add to `packages/shared` if the code is genuinely language-agnostic. Styling via CSS variables (`var(--color-primary)` etc.) is fine — both apps share the same design token names.

Each app's localStorage storage functions stay app-specific (different key namespaces). Only the pure algorithm and UI components belong in shared.

`SiteNav.astro` is the one `.astro` component in the package; the rest are React. Astro components import from a workspace package like any other — the export just has to be listed in `packages/shared/package.json` with its `.astro` extension.

### Site navigation

Both apps render `@tools/shared/components/SiteNav.astro` inside their layout header. It is the only navigation implementation: a desktop link row at `md` and above, and below that a hamburger trigger with a slide-in drawer. There is deliberately **no bottom tab bar** — it capped greek.tools at six destinations and suppressed the footer on mobile.

Adding a destination means adding one entry to that app's `navLinks` array in `Layout.astro`. Nothing else needs touching; the desktop nav, the drawer, and active-route highlighting all read the same list.

Things to know before changing it:

- **A `NavLink` with `children` is still a link.** greek.tools' Study entry points at `/study` *and* lists its five sub-routes, so the hub page stays reachable and the sub-routes are one tap away. The children also serve as the active-path list — that's what lights Study up on `/flashcards`, replacing the old hand-written `STUDY_PATHS` constant.
- **`isNavLinkActive` is the section, `isNavLinkCurrent` is the page.** The former drives highlighting (a group heading lights on any child route), the latter drives `aria-current="page"` (so a heading and its child don't both claim it).
- **The account link keeps `data-account-link` / `data-account-label`.** Each app's inline auth-hint script corrects those on prerendered pages, which ship with no session. The hint cookie has no authority — it only swaps the label and href.
- **The drawer's `visibility` transition is stepped, not eased** (`visibility 0s linear 220ms`, and `0s` on open). `initNavMenu` moves focus into the panel in the same tick it opens it, and a mid-transition `visibility` value would leave that focus call a no-op.
- **The component is self-styled with plain CSS in a scoped `<style>` block**, not Tailwind utilities. Tailwind's content detection is per-app and does not scan `packages/shared`, so utility classes there would emit no CSS. Design tokens still work — they are CSS variables (`var(--color-primary)`), and the accent gradient is passed in per app.

`initNavMenu` (`packages/shared/src/nav-menu.ts`) is framework-free DOM wiring against the `data-nav-*` attributes, which is what makes it directly testable without a renderer. Its tests are the coverage for the menu's behaviour; the Playwright specs in each app's `e2e/navigation.spec.ts` cover the parts only a real browser can show.

### The ink engine (`packages/shared/src/ink`)

Powers `/write` — handwriting practice with a stylus. `InkCanvas.tsx` owns only DOM wiring (listeners, coalesced samples, canvas sizing, drawing); every decision worth testing lives in framework-free modules beside it, the same split as `nav-menu.ts`. Roadmap and remaining phases: `apps/hebrew-tools/ROADMAP.md` Phase 9, issues #99–#105.

Things to know before changing it:

- **Nothing in `ink/` may mention a specific language.** A script is a `ScriptPack` data file (`apps/hebrew-tools/src/data/script-pack.ts`). If a port needs an engine change, generalize it in shared — do not special-case the app.
- **Joint circles must wind opposite to the default `arc()` direction.** Segment quads emit their corners along the travel direction, which always winds one way; a default arc winds the other. Under the nonzero fill rule the overlap cancels to a hole, and every stroke renders as a dashed line. `render.ts`'s `JOINT_WINDING` and its regression test pin this.
- **Palm rejection latches.** Once any `pointerType === 'pen'` event is seen, touch stops drawing for the life of the `InkCapture`. A pen landing mid-stroke *preempts* a touch stroke and discards it — that is the hand-lands-first case, not an edge case.
- **`document.fonts.load()` must resolve before the reference glyph is drawn or rasterized.** The reference is the answer key; rendering it early shows the student a fallback letterform, and rasterizing it early *scores* against one — silently, in a way nothing downstream can detect. `loadGlyphMask()` exists to own that await; do not call `rasterizeGlyph()` directly from app code.

- **`score/` is pure except for one function.** `rasterizeGlyph` is the only thing in the scoring path that touches a canvas, and it returns `null` rather than throwing when there is none — the app must fall back to self-assessment, because a missing canvas is not a reason to stop studying. Everything that decides anything takes a `Uint8Array` and is tested without a renderer.

- **Ink and mask must normalize identically, so `GlyphMask` carries its own `padding`.** Both are fitted to their own bounds and centered, preserving aspect ratio. That convention is what lets a student write anywhere on the surface at any size; a mask normalized on different terms from the ink silently scores placement instead of letterform.

- **Scoring grades shape occupancy, not letter identity.** A ד drawn as a ר scores well, and shin's dot is under 1% of the glyph's area so the wrong side barely registers. This is by design and is issue #103's job (stroke templates). Do not add heuristics to `geom.ts` that try to close it — the suggested SRS grade is a suggestion for exactly this reason, and every grade button stays live.
- **Ink is stored in CSS pixels, not device pixels.** The canvas scales by `devicePixelRatio` at draw time; baking that in would make saved strokes resolution-dependent.
- **Smoothing at capture time and interpolation at render time are separate on purpose.** Do not merge them — a render-grade spline applied to incoming samples rounds off real corners, and the square corner of ד is exactly what distinguishes it from ר.

## Pull requests

### Screenshots are required for any UI-affecting change

If a change alters what the app looks like, **capture screenshots and attach them to the PR**. This applies to layout, styling, component markup, new or changed pages, and anything responsive. It does not apply to pure logic, data, or build changes.

What to capture:

- **Both viewports** when the change touches responsive behaviour — mobile (390px) and desktop (1280px). A change that only shows up at one breakpoint still needs the other, to prove nothing regressed there.
- **Before and after**, when changing something that already existed. The "before" is the point — a lone "after" shot doesn't show what moved.
- **Both apps**, when the change touches `packages/shared`. It ships to greek.tools and hebrew.tools at once.

How to capture: drive a Playwright script against `pnpm dev` rather than taking manual screenshots — it is repeatable, and it gets exact viewport sizes. Two things to remember:

- **Hide the Astro dev toolbar**, or it floats over the bottom of every shot: `page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' })`.
- **Only one dev server can hold port 4321.** Both apps use it, and Playwright's `reuseExistingServer` means a stale server from the other app will silently serve the wrong site. Kill it between runs: `lsof -ti:4321 | xargs -r kill -9`.

How to attach: GitHub's image upload is web-UI only — there is no API for it, so `gh` cannot upload to it. Commit the images to an orphan branch (`assets/pr-<N>`) and reference them from the PR body by their `raw.githubusercontent.com` URL. That keeps binaries out of `main`'s history, and the branch can be deleted after the merge. The repo is public, so raw URLs render for everyone.

## Cloudflare Workers deployment

Each app deploys to its own Worker. CI runs `wrangler deploy` from each app's directory after a successful build — no dashboard configuration needed.

Secrets required in GitHub repo settings:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ANTHROPIC_API_KEY` (for `@claude` automation)

## CI

GitHub Actions workflows in `.github/workflows/`:

- `greek-tools.yml` — triggered by changes to `apps/greek-tools/**` or `packages/shared/**`
- `hebrew-tools.yml` — triggered by changes to `apps/hebrew-tools/**` or `packages/shared/**`
- `claude.yml` — triggers Claude Code on issues/PRs that mention `@claude`

Changing `packages/shared` triggers both app workflows.

## Greek-tools app notes

The production build runs two data scripts before `astro build`:
- `scripts/build-morphgnt.mjs` — fetches MorphGNT from GitHub, outputs per-book JSON to `public/data/morphgnt/`
- `scripts/build-vocabulary.mjs` — builds vocabulary data

These are skipped in dev. Run `pnpm build:data` to regenerate without a full build.

## Hebrew-tools app notes

See `apps/hebrew-tools/ROADMAP.md` for the full feature roadmap.

The production build runs the OSHB data pipeline before `astro build`:
- `scripts/build-morphhb.mjs` — fetches the Westminster Leningrad Codex and the
  OSHB Hebrew Lexicon, outputs per-book JSON, a book index and a lemma index to
  `public/data/morphhb/`

Skipped in dev if the data is already present. `pnpm build:data` regenerates
without a full build, `pnpm build:data:force` refetches. The parser's invariants
are in `apps/hebrew-tools/CLAUDE.md` under "OSHB data pipeline" — read those
before changing it.
