#!/usr/bin/env node
/**
 * Delete Nango connections whose end_user_id is not registered in user_accounts.
 * Frees quota on free/starter Nango plans after repeated login attempts.
 *
 * Usage: npx vite-node scripts/prune-nango-connections.mts [--dry-run]
 */
import { Nango } from '@nangohq/node';
import { ensureMigrated } from '../lib/db/migrate.js';
import { getSql, hasDatabase } from '../lib/db/client.js';

const dryRun = process.argv.includes('--dry-run');
const secretKey = process.env.NANGO_SECRET_KEY?.trim();
if (!secretKey) {
  console.error('Set NANGO_SECRET_KEY');
  process.exit(1);
}

await ensureMigrated();
const sql = getSql();
const registered = hasDatabase()
  ? new Set(
    (await sql<Array<{ nango_user_id: string }>>`SELECT nango_user_id FROM user_accounts`).map(r => r.nango_user_id),
  )
  : new Set<string>();

const nango = new Nango({ secretKey });
const { connections = [] } = await nango.listConnections({});
let deleted = 0;
let kept = 0;

for (const conn of connections) {
  const endUserId = conn.tags?.end_user_id;
  if (!endUserId) {
    kept += 1;
    continue;
  }
  if (registered.has(endUserId)) {
    kept += 1;
    continue;
  }
  console.log(`delete ${conn.provider_config_key}/${conn.connection_id} (end_user_id=${endUserId})`);
  if (!dryRun) {
    await nango.deleteConnection(conn.provider_config_key, conn.connection_id);
  }
  deleted += 1;
}

console.log(`\n${dryRun ? 'Would delete' : 'Deleted'} ${deleted}, kept ${kept} (${registered.size} registered end-user ids)`);
