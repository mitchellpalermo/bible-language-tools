// @ts-check

import { readFileSync } from 'node:fs';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { posthogHostGuard } from '@tools/shared/posthog-host-integration';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    react(),
    posthogHostGuard(process.env, {
      headers: readFileSync(new URL('./public/_headers', import.meta.url), 'utf8'),
    }),
  ],
  adapter: cloudflare(),
  // Astro's own cross-site form check cannot exempt a route, and Sign in with
  // Apple returns by a cross-site form POST. The middleware runs the same
  // check with that one exemption (`@tools/shared/origin-check`).
  security: { checkOrigin: false },
  // The /quiz hub was dropped in #229; Paradigms and Parse are reached from
  // /study. Old links and bookmarks land there.
  redirects: { '/quiz': '/study' },
  vite: {
    plugins: [tailwindcss()],
  },
});
