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

Chosen from five mockups (Nov 2026; scholarly, modern, fresh, fun, and a blend, since removed because Biome lints the HTML in them): the modern layout's big glyph
tiles and hairline rules, the fun one's sticker, tilted hard-shadow cards and hover wobble, and
the relaxed-but-serious feel of Mitch's blog (Lora headings, Inter body, warm stone neutrals,
a narrow left-aligned column, pill tags). Not the blog's orange: the apps keep their own
colours (greek `#1D4ED8`, hebrew `#15803D`) with the amber accent.

- **The apps are data.** `src/data/apps.ts` is the only place a card's name, glyph, blurb, tags
  and URL live. A third app is one entry; the cards, nav and footer all read the list.
- **Plain CSS in `src/styles/global.css`, tokens on `:root`.** This app does not share
  `packages/shared` styling, and shared components rely on per-app Tailwind scanning, so do not
  import them here. Dark mode is `prefers-color-scheme` plus a `data-theme` override saved in
  `localStorage` (`blt-theme`, in try/catch: storage can be unavailable). The inline script in
  `Layout.astro` applies it before first paint, which is why it is `is:inline`.
- **Tilts and the shadow are decoration.** `prefers-reduced-motion` turns the transitions off.
- **No copy that praises itself.** Mitch cut "small, careful" from the lede as silly; keep the
  text plain and descriptive.

## Deployment

Its own Worker (`bible-language-tools-landing`), serving `dist/` as static assets, deployed by
`.github/workflows/landing.yml` on `apps/landing/**` changes. The custom domains
`biblelanguage.tools` and `www.biblelanguage.tools` are Custom Domain routes in `wrangler.jsonc`, so
every deploy keeps them attached; the CI API token must be able to edit that zone's DNS. `www` is
attached as its own domain and serves the same page, it does not redirect. `public/_headers` sets the CSP: scripts are
inline-only (the theme toggle) and the sole third party is Google Fonts.
