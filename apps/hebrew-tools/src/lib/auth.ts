// Better Auth configuration.
//
// Sign-in is OAuth only: Google always, and Apple once its settings are in place
// (docs/apple-sign-in-setup.md). Email/password would need a reset flow, which
// needs outbound email, which needs the Workers Paid plan. See
// apps/greek-tools/docs/adr/005-oauth-as-sole-auth-provider.md.
//
// The user/session/account tables live in the shared bible-language-tools
// database alongside greek-tools', so signing in to both apps with the same
// Google account resolves to a single `users` row. Study progress is what stays
// separate, via the `language` column — see src/lib/db.ts.

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
      'https://hebrew.tools',
      'http://localhost:4321',
      ...(options.apple ? [APPLE_TRUSTED_ORIGIN] : []),
    ],
  });
}

export function createAuth(binding: D1Database, secret: string, options: CreateAuthOptions) {
  return createAuthForDb(createDb(binding), secret, options);
}

export type Auth = ReturnType<typeof createAuth>;
