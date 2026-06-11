import { createDb } from '@tools/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { SESSION_MAX_AGE_SECONDS } from './auth-cookie';
import { resetPasswordEmail, type SendEmailFn } from './email';

// Any Drizzle SQLite database with our schema: the D1 binding in production,
// better-sqlite3 in integration tests.
type AuthDb = Parameters<typeof drizzleAdapter>[0];

export interface CreateAuthOptions {
  /** Required for flows that put links in emails — without it Better Auth
   * generates relative URLs that are useless in an inbox. Pass the request
   * origin: `new URL(request.url).origin`. */
  baseURL?: string;
  sendEmail?: SendEmailFn;
}

// Only the forgot-password handler passes a real sender; every other caller
// never triggers requestPasswordReset, so the default logs instead of sending.
const logOnlySender: SendEmailFn = async (content) => {
  console.warn(`[auth] No email sender configured; dropping "${content.subject}" to ${content.to}`);
};

export function createAuthForDb(db: AuthDb, secret: string, options: CreateAuthOptions = {}) {
  const sendEmail = options.sendEmail ?? logOnlySender;
  return betterAuth({
    // usePlural maps Better Auth model names to our plural table exports
    // (user → users, session → sessions, account → accounts, ...)
    database: drizzleAdapter(db, { provider: 'sqlite', usePlural: true }),
    secret,
    baseURL: options.baseURL,
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({ to: user.email, ...resetPasswordEmail(url) });
      },
    },
    session: { expiresIn: SESSION_MAX_AGE_SECONDS },
    trustedOrigins: ['https://greek.tools', 'http://localhost:4321'],
  });
}

export function createAuth(binding: D1Database, secret: string, options?: CreateAuthOptions) {
  return createAuthForDb(createDb(binding), secret, options);
}

export type Auth = ReturnType<typeof createAuth>;
