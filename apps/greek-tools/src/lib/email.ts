// Transactional email via the Cloudflare Email Service binding.
//
// The from domain must be onboarded for sending (`wrangler email sending
// enable greek.tools`) before the first real send. In local dev the binding
// is absent and the sender logs the message instead, which keeps the reset
// flow testable without email infrastructure.

export interface EmailContent {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailFn = (content: EmailContent) => Promise<void>;

export const EMAIL_FROM = { email: 'no-reply@greek.tools', name: 'greek.tools' };

export function createEmailSender(binding: SendEmail | undefined): SendEmailFn {
  return async (content) => {
    if (!binding) {
      // Local dev fallback — the reset link is in the text body
      console.warn(`[email] No EMAIL binding; not sending "${content.subject}" to ${content.to}`);
      console.warn(`[email] ${content.text}`);
      return;
    }
    await binding.send({
      from: EMAIL_FROM,
      to: content.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  };
}

export function resetPasswordEmail(url: string): Omit<EmailContent, 'to'> {
  return {
    subject: 'Reset your greek.tools password',
    text: [
      'Someone (hopefully you) asked to reset the password for your greek.tools account.',
      '',
      `Reset it here: ${url}`,
      '',
      'The link expires in one hour. If you did not ask for this, you can ignore this email — your password is unchanged.',
    ].join('\n'),
    html: [
      '<p>Someone (hopefully you) asked to reset the password for your greek.tools account.</p>',
      `<p><a href="${url}">Reset your password</a></p>`,
      '<p>The link expires in one hour. If you did not ask for this, you can ignore this email — your password is unchanged.</p>',
    ].join('\n'),
  };
}
