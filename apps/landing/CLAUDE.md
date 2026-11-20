# landing

The parent site for [greek.tools](https://greek.tools) and [hebrew.tools](https://hebrew.tools):
one page, a card for each app. Static Astro 5, plain CSS, no React, no Tailwind, no
database, no analytics. It is a signpost, not an app.

```bash
pnpm dev:landing        # from the repo root
pnpm build:landing
pnpm --filter landing test:run
```

## Design

Built from the apps' own styling so it reads as their parent (Nov 2026, after Mitch found the
first blend, with sticker cards and the blog's Lora, too playful): Plus Jakarta Sans, the
lowercase `bible language.tools` wordmark with amber ".tools", an indigo header bar with the apps'
five-colour gradient hairline, and cards like each app's homepage cards (white, rounded, a 6px
top strip in the app's colour, a tinted glyph badge, a coloured title, "Open →" on hover). The
apps keep their own colours (greek `#1D4ED8`, hebrew `#15803D`). Considered and left out: a
"Pick a language" pill (above the headline it is a call to action with no action; as buttons it
duplicates the cards), and a flat variant with a white header and no card strip, which is a small CSS change if wanted.

- **The apps are data.** `src/data/apps.ts` is the only place a card's name, glyph, blurb, tags
  and URL live. A third app is one entry; the cards, nav and footer all read the list.
- **Plain CSS in `src/styles/global.css`, tokens on `:root`.** This app does not share
  `packages/shared` styling, and shared components rely on per-app Tailwind scanning, so do not
  import them here. Dark mode is `prefers-color-scheme` plus a `data-theme` override saved in
  `localStorage` (`blt-theme`, in try/catch: storage can be unavailable). The inline script in
  `Layout.astro` applies it before first paint, which is why it is `is:inline`.
- **The tilt, the glyph wobble and the arrow are decoration, kept light on purpose (Mitch wanted a little fun back, not the first blend).** `prefers-reduced-motion` turns the transitions off, and the arrow stays visible where there is no hover.
- **No copy that praises itself.** Mitch cut "small, careful" from the lede as silly; keep the
  text plain and descriptive.

## Deployment

Its own Worker (`bible-language-tools`, named for the app; the D1 database of the same name belongs to the other two), serving `dist/` as static assets, deployed by
`.github/workflows/landing.yml` on `apps/landing/**` changes. The custom domains
(`biblelanguage.tools` and `www.biblelanguage.tools`) are attached once in the Cloudflare
dashboard (Worker, Settings, Domains & Routes), not in `wrangler.jsonc`, the same as greek.tools
and hebrew.tools. A `routes` block was tried first and removed: it makes every deploy look up the
zone, which needs a token that can see it and an exact `CLOUDFLARE_ACCOUNT_ID`.
`public/_headers` sets the CSP: scripts are
inline-only (the theme toggle) and the sole third party is Google Fonts.
