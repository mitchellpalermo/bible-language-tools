// @ts-check

import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { posthogHostGuard } from '@tools/shared/posthog-host-integration';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [react(), posthogHostGuard(process.env)],
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
  },
});
