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
  vite: {
    plugins: [tailwindcss()],
  },
});
