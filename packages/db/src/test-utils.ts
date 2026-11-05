import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const migrationsDir = join(import.meta.dirname, '..', 'migrations');

/** Every migration file, in the order wrangler applies them. */
export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function applyMigration(sqlite: Database.Database, file: string): void {
  const migrationSql = readFileSync(join(migrationsDir, file), 'utf-8');
  // drizzle-kit generates migrations with '--> statement-breakpoint' separators
  for (const stmt of migrationSql.split('--> statement-breakpoint')) {
    const sql = stmt.trim();
    if (sql) sqlite.exec(sql);
  }
}

export function createTestDb() {
  const sqlite = new Database(':memory:');
  for (const file of migrationFiles()) applyMigration(sqlite, file);
  return drizzle(sqlite, { schema });
}

/**
 * A database at an older schema, for testing a migration against data written
 * before it: apply migrations up to and including `lastApplied`, seed through
 * `sqlite` with plain SQL (the Drizzle schema already describes the newer
 * columns), then call `migrateRest()`.
 */
export function createTestDbAt(lastApplied: string) {
  const files = migrationFiles();
  const cut = files.findIndex((f) => f.startsWith(lastApplied));
  if (cut === -1) throw new Error(`No migration named ${lastApplied}`);
  const sqlite = new Database(':memory:');
  for (const file of files.slice(0, cut + 1)) applyMigration(sqlite, file);
  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
    /** Apply what is left, or only up to and including `through` (a prefix, like `lastApplied`). */
    migrateRest(through?: string) {
      const end =
        through === undefined ? files.length : files.findIndex((f) => f.startsWith(through)) + 1;
      if (end === 0) throw new Error(`No migration named ${through}`);
      for (const file of files.slice(cut + 1, end)) applyMigration(sqlite, file);
    },
  };
}
