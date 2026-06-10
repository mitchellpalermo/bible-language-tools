import { defineMiddleware } from 'astro:middleware';
import { createAuth } from './lib/auth';

export const onRequest = defineMiddleware(async ({ locals, request }, next) => {
  const { DB, AUTH_SECRET } = locals.runtime.env;
  const auth = createAuth(DB, AUTH_SECRET);
  const session = await auth.api.getSession({ headers: request.headers });
  locals.user = session?.user ? { id: session.user.id, email: session.user.email } : null;
  return next();
});
