import { defineMiddleware } from 'astro:middleware';
import { createAuth } from './lib/auth';
import { authHintClearCookie, authHintSetCookie } from './lib/auth-cookie';

export const onRequest = defineMiddleware(async ({ locals, request }, next) => {
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

  // Keep the gt-auth hint cookie in sync with the real session so that
  // OAuth sign-in (which has no explicit set-cookie step) still flips the nav.
  const hasHintCookie = request.headers.get('cookie')?.includes('gt-auth=1') ?? false;
  if (locals.user && !hasHintCookie) {
    response.headers.append('Set-Cookie', authHintSetCookie());
  } else if (!locals.user && hasHintCookie) {
    response.headers.append('Set-Cookie', authHintClearCookie());
  }

  return response;
});
