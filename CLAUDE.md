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

See `apps/hebrew-tools/ROADMAP.md` for the full feature roadmap. Phase 1 (Hebrew Keyboard) is the starting point. The data pipeline (`build-morphhb.mjs` + OSHB data) is the critical dependency for Phases 3 and 4.
