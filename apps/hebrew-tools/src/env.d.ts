/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

/**
 * Cloudflare Worker bindings. `DB` is the shared bible-language-tools D1
 * database — see wrangler.jsonc. The auth secrets greek-tools declares here
 * (BETTER_AUTH_SECRET, GOOGLE_CLIENT_*) arrive with the auth layer; see #91.
 */
interface Env {
  DB: D1Database;
}

declare namespace App {
  interface Locals extends Runtime {}
}

interface ImportMetaEnv {
  readonly PUBLIC_POSTHOG_KEY: string;
  readonly PUBLIC_POSTHOG_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
