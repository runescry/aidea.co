#!/usr/bin/env npx tsx
/**
 * Run school inbox sync (deterministic, no LLM).
 *
 * Usage:
 *   npm run test:school-inbox          # unit tests (mocked)
 *   npm run test:school-inbox:run      # dry-run against fixtures path
 *   INTEGRATION_GMAIL=1 npm run test:school-inbox:run   # live Gmail via Nango
 */
import { loadEnvLocal } from '../tests/integration/setup';
import { syncSchoolInbox } from '../lib/harness/school-inbox-sync';

loadEnvLocal();

async function main(): Promise<void> {
  const live = process.env.INTEGRATION_GMAIL === '1';
  console.log(`School inbox sync (${live ? 'live Gmail' : 'local'})…\n`);

  if (!live) {
    console.log('Set INTEGRATION_GMAIL=1 to run against connected Gmail.');
    console.log('Running sync anyway — requires Nango + Gmail when live.\n');
  }

  const result = await syncSchoolInbox();
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
