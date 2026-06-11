import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';
import { createEmailSender } from '../../../lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  if (!email) {
    return redirect('/account/forgot-password?error=missing');
  }

  const { DB, BETTER_AUTH_SECRET, EMAIL } = locals.runtime.env;
  // baseURL makes the emailed link absolute (origin + /api/auth prefix)
  const auth = createAuth(DB, BETTER_AUTH_SECRET, {
    sendEmail: createEmailSender(EMAIL),
    baseURL: new URL(request.url).origin,
  });

  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: '/account/reset-password' },
      headers: request.headers,
    });
  } catch {
    // Fall through to the same response — never reveal whether the email
    // is registered or whether sending failed.
  }

  return redirect('/account/forgot-password?sent=1');
};
