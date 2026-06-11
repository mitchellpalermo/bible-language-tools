import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';
import { authHintSetCookie } from '../../../lib/auth-cookie';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const from = String(form.get('from') ?? '/account');
  const dest = from.startsWith('/') ? from : '/account';

  const { DB, BETTER_AUTH_SECRET } = locals.runtime.env;
  const auth = createAuth(DB, BETTER_AUTH_SECRET);

  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });

  if (!response.ok) {
    const fromParam = dest !== '/account' ? `&from=${encodeURIComponent(dest)}` : '';
    return redirect(`/account/signin?error=invalid${fromParam}`);
  }

  // Land on the syncing interstitial, which pulls and merges server progress
  // before continuing to the real destination.
  const destResponse = new Response(null, {
    status: 302,
    headers: { Location: `/account/syncing?to=${encodeURIComponent(dest)}` },
  });
  for (const cookie of response.headers.getSetCookie()) {
    destResponse.headers.append('Set-Cookie', cookie);
  }
  destResponse.headers.append('Set-Cookie', authHintSetCookie());
  return destResponse;
};
