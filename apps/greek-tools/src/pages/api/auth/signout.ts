import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const { DB, AUTH_SECRET } = locals.runtime.env;
  const auth = createAuth(DB, AUTH_SECRET);

  const response = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  const dest = new Response(null, { status: 302, headers: { Location: '/' } });
  for (const cookie of response.headers.getSetCookie()) {
    dest.headers.append('Set-Cookie', cookie);
  }
  return dest;
};
