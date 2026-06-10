import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';

export const prerender = false;

const handler: APIRoute = async ({ request, locals }) => {
  const { DB, AUTH_SECRET } = locals.runtime.env;
  const auth = createAuth(DB, AUTH_SECRET);
  return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
