import { createDb } from '@tools/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { SESSION_MAX_AGE_SECONDS } from './auth-cookie';

type AuthDb = Parameters<typeof drizzleAdapter>[0];

export interface CreateAuthOptions {
  baseURL: string;
  googleClientId: string;
  googleClientSecret: string;
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
    },
    session: { expiresIn: SESSION_MAX_AGE_SECONDS },
    trustedOrigins: ['https://greek.tools', 'http://localhost:4321'],
  });
}

export function createAuth(binding: D1Database, secret: string, options: CreateAuthOptions) {
  return createAuthForDb(createDb(binding), secret, options);
}

export type Auth = ReturnType<typeof createAuth>;
