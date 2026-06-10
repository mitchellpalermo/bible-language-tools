import { createDb } from '@tools/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { SESSION_MAX_AGE_SECONDS } from './auth-cookie';

// Any Drizzle SQLite database with our schema: the D1 binding in production,
// better-sqlite3 in integration tests.
type AuthDb = Parameters<typeof drizzleAdapter>[0];

export function createAuthForDb(db: AuthDb, secret: string) {
  return betterAuth({
    // usePlural maps Better Auth model names to our plural table exports
    // (user → users, session → sessions, account → accounts, ...)
    database: drizzleAdapter(db, { provider: 'sqlite', usePlural: true }),
    secret,
    emailAndPassword: { enabled: true },
    session: { expiresIn: SESSION_MAX_AGE_SECONDS },
    trustedOrigins: ['https://greek.tools', 'http://localhost:4321'],
  });
}

export function createAuth(binding: D1Database, secret: string) {
  return createAuthForDb(createDb(binding), secret);
}

export type Auth = ReturnType<typeof createAuth>;
