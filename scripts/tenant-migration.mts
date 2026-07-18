#!/usr/bin/env npx tsx
/**
 * Inspect or copy data between Postgres user_id tenants.
 *
 * Safe default: reports row counts only.
 * Copy mode requires both --to=<user_id> and --apply.
 *
 * Examples:
 *   npm run tenant:report
 *   npm run tenant:migrate -- --from=default --to=google:user_123 --apply
 */
import { loadEnvLocal } from '../tests/integration/setup';
import { ensureMigrated } from '../lib/db/migrate';
import { getDatabaseUrl, getSql } from '../lib/db/client';

loadEnvLocal();

type CountRow = {
  table: string;
  count: number;
};

type Args = {
  from: string;
  to?: string;
  apply: boolean;
  json: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { from: 'default', apply: false, json: false };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--json') args.json = true;
    else if (arg.startsWith('--from=')) args.from = arg.slice('--from='.length).trim();
    else if (arg.startsWith('--to=')) args.to = arg.slice('--to='.length).trim();
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.from) throw new Error('--from cannot be empty');
  if (args.to !== undefined && !args.to) throw new Error('--to cannot be empty');
  return args;
}

function printHelp(): void {
  console.log(`Usage:
  npm run tenant:report [-- --from=default] [--json]
  npm run tenant:migrate -- --from=default --to=<target-user-id> --apply

Options:
  --from=<user_id>  Source tenant to inspect/copy. Defaults to default.
  --to=<user_id>    Target tenant for copy mode.
  --apply           Required to write copied rows.
  --json            Print machine-readable JSON.
`);
}

async function tenantCounts(userId: string): Promise<CountRow[]> {
  const sql = getSql();
  const [row] = await sql<[{ counts: Record<string, number> }]>`
    SELECT jsonb_build_object(
      'profiles', (SELECT COUNT(*)::int FROM profiles WHERE user_id = ${userId}),
      'action_queue', (SELECT COUNT(*)::int FROM action_queue WHERE user_id = ${userId}),
      'harness_entities', (SELECT COUNT(*)::int FROM harness_entities WHERE user_id = ${userId}),
      'latest_briefs', (SELECT COUNT(*)::int FROM latest_briefs WHERE user_id = ${userId}),
      'app_settings', (SELECT COUNT(*)::int FROM app_settings WHERE user_id = ${userId}),
      'chat_store', (SELECT COUNT(*)::int FROM chat_store WHERE user_id = ${userId}),
      'chat_conversations', (SELECT COUNT(*)::int FROM chat_conversations WHERE user_id = ${userId}),
      'chat_meta', (SELECT COUNT(*)::int FROM chat_meta WHERE user_id = ${userId}),
      'action_audit', (SELECT COUNT(*)::int FROM action_audit WHERE user_id = ${userId})
    ) AS counts
  `;
  return Object.entries(row.counts).map(([table, count]) => ({ table, count }));
}

async function copyTenant(from: string, to: string): Promise<void> {
  if (from === to) throw new Error('--from and --to must be different');
  const sql = getSql();

  await sql.begin(async tx => {
    await tx`
      INSERT INTO profiles (user_id, data, updated_at)
      SELECT ${to}, data, NOW() FROM profiles WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    await tx`
      INSERT INTO action_queue (id, user_id, payload, status, created_at)
      SELECT id, ${to}, payload, status, created_at FROM action_queue WHERE user_id = ${from}
      ON CONFLICT (id, user_id) DO UPDATE SET payload = EXCLUDED.payload, status = EXCLUDED.status
    `;
    await tx`
      INSERT INTO harness_entities (id, user_id, data, updated_at)
      SELECT id, ${to}, data, updated_at FROM harness_entities WHERE user_id = ${from}
      ON CONFLICT (id, user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
    await tx`
      INSERT INTO latest_briefs (user_id, data, generated_at)
      SELECT ${to}, data, generated_at FROM latest_briefs WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, generated_at = EXCLUDED.generated_at
    `;
    await tx`
      INSERT INTO app_settings (user_id, data, updated_at)
      SELECT ${to}, data, updated_at FROM app_settings WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
    await tx`
      INSERT INTO chat_store (user_id, data, updated_at)
      SELECT ${to}, data, updated_at FROM chat_store WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
    await tx`
      INSERT INTO chat_conversations (id, user_id, title, messages, created_at, updated_at)
      SELECT id, ${to}, title, messages, created_at, updated_at FROM chat_conversations WHERE user_id = ${from}
      ON CONFLICT (id, user_id) DO UPDATE SET title = EXCLUDED.title, messages = EXCLUDED.messages, updated_at = EXCLUDED.updated_at
    `;
    await tx`
      INSERT INTO chat_meta (user_id, active_conversation_id, updated_at)
      SELECT ${to}, active_conversation_id, updated_at FROM chat_meta WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE SET active_conversation_id = EXCLUDED.active_conversation_id, updated_at = EXCLUDED.updated_at
    `;
    await tx`
      INSERT INTO action_audit (id, user_id, action_id, payload, resolved_at)
      SELECT id, ${to}, action_id, payload, resolved_at FROM action_audit WHERE user_id = ${from}
      ON CONFLICT (id, user_id) DO UPDATE SET action_id = EXCLUDED.action_id, payload = EXCLUDED.payload, resolved_at = EXCLUDED.resolved_at
    `;
  });
}

function printCounts(label: string, userId: string, rows: CountRow[]): void {
  console.log(`\n${label} (${userId})`);
  console.table(rows);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!getDatabaseUrl()) {
    throw new Error('DATABASE_URL/POSTGRES_URL/POSTGRES_PRISMA_URL is required for tenant inspection.');
  }

  await ensureMigrated();
  const beforeSource = await tenantCounts(args.from);
  const beforeTarget = args.to ? await tenantCounts(args.to) : null;

  if (args.json) {
    console.log(JSON.stringify({ before: { [args.from]: beforeSource, ...(args.to ? { [args.to]: beforeTarget } : {}) } }, null, 2));
  } else {
    printCounts('Source tenant', args.from, beforeSource);
    if (args.to && beforeTarget) printCounts('Target tenant before copy', args.to, beforeTarget);
  }

  if (!args.to) return;
  if (!args.apply) {
    console.log('\nDry run only. Re-run with --apply to copy source tenant rows to the target tenant.');
    return;
  }

  await copyTenant(args.from, args.to);
  const afterTarget = await tenantCounts(args.to);
  if (args.json) {
    console.log(JSON.stringify({ after: { [args.to]: afterTarget } }, null, 2));
  } else {
    printCounts('Target tenant after copy', args.to, afterTarget);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
