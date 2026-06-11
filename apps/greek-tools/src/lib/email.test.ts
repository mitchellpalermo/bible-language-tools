import { describe, expect, it, vi } from 'vitest';
import { createEmailSender, EMAIL_FROM, resetPasswordEmail } from './email';

describe('createEmailSender', () => {
  const content = {
    to: 'student@example.com',
    subject: 'Reset your greek.tools password',
    html: '<p>link</p>',
    text: 'link',
  };

  it('sends through the binding with the greek.tools from address', async () => {
    const send = vi.fn().mockResolvedValue({ messageId: 'abc' });
    const sender = createEmailSender({ send } as never);

    await sender(content);

    expect(send).toHaveBeenCalledWith({
      from: EMAIL_FROM,
      to: 'student@example.com',
      subject: 'Reset your greek.tools password',
      html: '<p>link</p>',
      text: 'link',
    });
  });

  it('logs instead of throwing when the binding is absent (local dev)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sender = createEmailSender(undefined);

    await expect(sender(content)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('resetPasswordEmail', () => {
  it('includes the reset link in both bodies and mentions expiry', () => {
    const url = 'https://greek.tools/api/auth/reset-password/tok123?callbackURL=%2Faccount';
    const email = resetPasswordEmail(url);

    expect(email.text).toContain(url);
    expect(email.html).toContain(`href="${url}"`);
    expect(email.text).toMatch(/expires in one hour/);
    expect(email.subject).toMatch(/reset/i);
  });
});
