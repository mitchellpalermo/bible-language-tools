import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from './schema';

export function createTestDb() {
  const sqlite = new Database(':memory:');

  const migrationsDir = join(import.meta.dirname, '..', 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const migrationSql = readFileSync(join(migrationsDir, file), 'utf-8');
    // drizzle-kit generates migrations with '--> statement-breakpoint' separators
    for (const stmt of migrationSql.split('--> statement-breakpoint')) {
      const sql = stmt.trim();
      if (sql) sqlite.exec(sql);
    }
  }

  return drizzle(sqlite, { schema });
}
