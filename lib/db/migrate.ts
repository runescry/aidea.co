import { readFileSync } from 'fs';
import { join } from 'path';
import { getSql, hasDatabase } from './client';

const globalForDb = globalThis as typeof globalThis & {
  __aideaDbMigrated?: boolean;
  __aideaDbMigratePromise?: Promise<void>;
};

let migrated = false;

async function runMigration(): Promise<void> {
  const sql = getSql();
  const schema = readFileSync(join(process.cwd(), 'lib/db/schema.sql'), 'utf-8');
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await sql.unsafe(statement);
  }

  migrated = true;
  globalForDb.__aideaDbMigrated = true;
}

export async function ensureMigrated(): Promise<void> {
  if (globalForDb.__aideaDbMigrated || migrated || !hasDatabase()) return;

  if (!globalForDb.__aideaDbMigratePromise) {
    globalForDb.__aideaDbMigratePromise = runMigration().finally(() => {
      globalForDb.__aideaDbMigratePromise = undefined;
    });
  }

  await globalForDb.__aideaDbMigratePromise;
}
