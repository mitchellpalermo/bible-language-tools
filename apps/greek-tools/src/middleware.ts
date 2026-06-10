import { defineMiddleware } from 'astro:middleware';
import { createAuth } from './lib/auth';

export const onRequest = defineMiddleware(async ({ locals, request }, next) => {
  // During `astro build` prerendering there is no Cloudflare runtime, so the
  // D1 binding and secret are unavailable. Static pages render with no user;
  // pages that need the session opt out of prerendering instead.
  const env = locals.runtime?.env;
  if (!env?.DB || !env?.BETTER_AUTH_SECRET) {
    locals.user = null;
    return next();
  }
  const auth = createAuth(env.DB, env.BETTER_AUTH_SECRET);
  const session = await auth.api.getSession({ headers: request.headers });
  locals.user = session?.user ? { id: session.user.id, email: session.user.email } : null;
  return next();
});
