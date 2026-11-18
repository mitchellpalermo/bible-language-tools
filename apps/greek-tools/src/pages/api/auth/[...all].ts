import { resolveAppleCredentials } from '@tools/shared/apple-sign-in';
import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';

export const prerender = false;

const handler: APIRoute = async ({ request, locals }) => {
  const { env } = locals.runtime;
  const { DB, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;
  const apple = await resolveAppleCredentials(env);
  const auth = createAuth(DB, BETTER_AUTH_SECRET, {
    baseURL: new URL(request.url).origin,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
    apple,
  });
  return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
