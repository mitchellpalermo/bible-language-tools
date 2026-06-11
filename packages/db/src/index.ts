import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

export function createDb(binding: D1Database) {
  return drizzle(binding, { schema });
}

export * from './schema';
