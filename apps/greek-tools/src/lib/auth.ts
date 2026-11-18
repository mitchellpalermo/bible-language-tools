import { createDb } from '@tools/db';
import { APPLE_TRUSTED_ORIGIN, type AppleProviderCredentials } from '@tools/shared/apple-sign-in';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { SESSION_MAX_AGE_SECONDS } from './auth-cookie';

type AuthDb = Parameters<typeof drizzleAdapter>[0];

export interface CreateAuthOptions {
  baseURL: string;
  googleClientId: string;
  googleClientSecret: string;
  /**
   * Sign in with Apple, when configured. The auth route resolves this (it signs
   * Apple's client secret); the session check in the middleware leaves it out.
   */
  apple?: AppleProviderCredentials;
}

export function createAuthForDb(db: AuthDb, secret: string, options: CreateAuthOptions) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', usePlural: true }),
    secret,
    baseURL: options.baseURL,
    socialProviders: {
      google: {
        clientId: options.googleClientId,
        clientSecret: options.googleClientSecret,
      },
      ...(options.apple ? { apple: options.apple } : {}),
    },
    session: { expiresIn: SESSION_MAX_AGE_SECONDS },
    // Apple answers with a cross-site form POST from its own origin.
    trustedOrigins: [
      'https://greek.tools',
      'http://localhost:4321',
      ...(options.apple ? [APPLE_TRUSTED_ORIGIN] : []),
    ],
  });
}

export function createAuth(binding: D1Database, secret: string, options: CreateAuthOptions) {
  return createAuthForDb(createDb(binding), secret, options);
}

export type Auth = ReturnType<typeof createAuth>;
