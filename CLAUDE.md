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
| `@tools/shared/components/NumberToggle` | Sg/Pl pill toggle (mobile only) |
| `@tools/shared/components/EndingsToggle` | Full forms / Endings only toggle |
| `@tools/shared/components/SectionHeading` | Anchor-linked section heading |
| `@tools/shared/components/DescriptionBar` | Hover description bar for paradigm tables |

### Adding to shared

Only add to `packages/shared` if the code is genuinely language-agnostic. Styling via CSS variables (`var(--color-primary)` etc.) is fine — both apps share the same design token names.

Each app's localStorage storage functions stay app-specific (different key namespaces). Only the pure algorithm and UI components belong in shared.

## Cloudflare Pages deployment

Each app deploys to its own Pages project. CI runs `wrangler pages deploy` from each app's directory after a successful build — no dashboard configuration needed.

Secrets required in GitHub repo settings:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
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
