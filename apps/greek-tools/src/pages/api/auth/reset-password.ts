import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');

  if (!token) {
    return redirect('/account/reset-password?error=invalid');
  }
  if (password.length < 8) {
    return redirect(`/account/reset-password?error=short&token=${encodeURIComponent(token)}`);
  }

  const { DB, BETTER_AUTH_SECRET } = locals.runtime.env;
  const auth = createAuth(DB, BETTER_AUTH_SECRET);

  const response = await auth.api.resetPassword({
    body: { newPassword: password, token },
    asResponse: true,
  });

  if (!response.ok) {
    // Expired, already used, or forged token — same generic path for all
    return redirect('/account/reset-password?error=invalid');
  }

  return redirect('/account/signin?reset=1');
};
