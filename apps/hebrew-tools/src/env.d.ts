/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

/**
 * Cloudflare Worker bindings. `DB` is the shared bible-language-tools D1
 * database (see wrangler.jsonc); the three auth values are Worker secrets,
 * pushed by the deploy workflow and read from .dev.vars locally.
 */
interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

declare namespace App {
  interface Locals extends Runtime {
    /** Resolved by src/middleware.ts on every SSR request. */
    user: { id: string; email: string } | null;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_POSTHOG_KEY: string;
  readonly PUBLIC_POSTHOG_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
