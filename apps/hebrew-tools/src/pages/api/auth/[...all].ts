import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';

export const prerender = false;

const handler: APIRoute = async ({ request, locals }) => {
  const { DB, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = locals.runtime.env;
  const auth = createAuth(DB, BETTER_AUTH_SECRET, {
    baseURL: new URL(request.url).origin,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
  });
  return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
