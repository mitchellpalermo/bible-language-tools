import { defineMiddleware } from 'astro:middleware';
import { createAuth } from './lib/auth';
import { AUTH_HINT_COOKIE, authHintClearCookie, authHintSetCookie } from './lib/auth-cookie';

export const onRequest = defineMiddleware(async ({ locals, request }, next) => {
  // No bindings (plain `astro dev` without .dev.vars, or a preview build) —
  // degrade to signed-out rather than throwing on every request.
  const env = locals.runtime?.env;
  if (
    !env?.DB ||
    !env?.BETTER_AUTH_SECRET ||
    !env?.GOOGLE_CLIENT_ID ||
    !env?.GOOGLE_CLIENT_SECRET
  ) {
    locals.user = null;
    return next();
  }

  const auth = createAuth(env.DB, env.BETTER_AUTH_SECRET, {
    baseURL: new URL(request.url).origin,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  });
  const session = await auth.api.getSession({ headers: request.headers });
  locals.user = session?.user ? { id: session.user.id, email: session.user.email } : null;

  const response = await next();

  // Keep the hint cookie in sync with the real session. OAuth sign-in returns
  // through Better Auth's handler, which has no set-cookie step of ours, so
  // without this the nav would stay signed-out until the next full navigation.
  const hasHintCookie = request.headers.get('cookie')?.includes(`${AUTH_HINT_COOKIE}=1`) ?? false;
  if (locals.user && !hasHintCookie) {
    response.headers.append('Set-Cookie', authHintSetCookie());
  } else if (!locals.user && hasHintCookie) {
    response.headers.append('Set-Cookie', authHintClearCookie());
  }

  return response;
});
