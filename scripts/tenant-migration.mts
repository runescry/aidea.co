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
import { getDatabaseUrl } from '../lib/db/client';
import { copyTenantData, tenantCounts, type TenantCount } from '../lib/storage/tenant-copy';

loadEnvLocal();

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

function printCounts(label: string, userId: string, rows: TenantCount[]): void {
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

  await copyTenantData(args.from, args.to, true);
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
