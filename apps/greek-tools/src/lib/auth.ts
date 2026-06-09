import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth';
import { createDb } from '@tools/db';

export function createAuth(binding: D1Database, secret: string) {
  const db = createDb(binding);
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    secret,
    emailAndPassword: { enabled: true },
    trustedOrigins: ['https://greek.tools', 'http://localhost:4321'],
  });
}

export type Auth = ReturnType<typeof createAuth>;
