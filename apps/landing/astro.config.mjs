// @ts-check

import { defineConfig } from 'astro/config';

// A static site: no adapter, no Worker code. `wrangler deploy` serves ./dist
// as assets (see wrangler.jsonc).
export default defineConfig({});
