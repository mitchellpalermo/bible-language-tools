import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');

  const { DB, AUTH_SECRET } = locals.runtime.env;
  const auth = createAuth(DB, AUTH_SECRET);

  const response = await auth.api.signUpEmail({
    body: { email, password, name: email },
    asResponse: true,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const code = (body as { code?: string }).code;
    const errorParam = code === 'USER_ALREADY_EXISTS' ? 'email_taken' : 'error';
    return redirect(`/account/signup?error=${errorParam}`);
  }

  // getSetCookie() returns individual values without comma-joining
  const dest = new Response(null, { status: 302, headers: { Location: '/account' } });
  for (const cookie of response.headers.getSetCookie()) {
    dest.headers.append('Set-Cookie', cookie);
  }
  return dest;
};
