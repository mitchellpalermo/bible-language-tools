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
  // The /quiz hub was dropped in #229; Paradigms and Parse are reached from
  // /study. Old links and bookmarks land there.
  redirects: { '/quiz': '/study' },
  vite: {
    plugins: [tailwindcss()],
  },
});
