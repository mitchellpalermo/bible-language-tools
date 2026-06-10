/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  AUTH_SECRET: string;
}

declare namespace App {
  interface Locals extends Runtime {
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
