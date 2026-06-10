import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';
import { authHintSetCookie } from '../../../lib/auth-cookie';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');

  const { DB, BETTER_AUTH_SECRET } = locals.runtime.env;
  const auth = createAuth(DB, BETTER_AUTH_SECRET);

  const response = await auth.api.signUpEmail({
    body: { email, password, name: email },
    asResponse: true,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const code = (body as { code?: string }).code ?? '';
    // Better Auth has used both USER_ALREADY_EXISTS and
    // USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL across versions
    const errorParam = code.startsWith('USER_ALREADY_EXISTS') ? 'email_taken' : 'error';
    return redirect(`/account/signup?error=${errorParam}`);
  }

  // Land on the welcome interstitial, which offers to import any existing
  // local study progress into the new account.
  // getSetCookie() returns individual values without comma-joining
  const dest = new Response(null, { status: 302, headers: { Location: '/account/welcome' } });
  for (const cookie of response.headers.getSetCookie()) {
    dest.headers.append('Set-Cookie', cookie);
  }
  dest.headers.append('Set-Cookie', authHintSetCookie());
  return dest;
};
