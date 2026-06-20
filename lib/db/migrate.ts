import { readFileSync } from 'fs';
import { join } from 'path';
import { getSql, hasDatabase } from './client';

const globalForDb = globalThis as typeof globalThis & { __aideaDbMigrated?: boolean };

let migrated = false;

export async function ensureMigrated(): Promise<void> {
  if (globalForDb.__aideaDbMigrated || migrated || !hasDatabase()) return;

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
