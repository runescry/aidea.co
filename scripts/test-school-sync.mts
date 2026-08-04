#!/usr/bin/env npx tsx
/**
 * Run school SharePoint sync (deterministic, no LLM).
 *
 * Usage:
 *   npm run test:school-sync
 *   INTEGRATION_MICROSOFT=1 npm run test:school-sync:run
 */
import { loadEnvLocal } from '../tests/integration/setup';
import { syncSchoolSharePoint } from '../lib/harness/school-sharepoint-sync';

loadEnvLocal();

async function main(): Promise<void> {
  const live = process.env.INTEGRATION_MICROSOFT === '1';
  console.log(`School SharePoint sync (${live ? 'live Microsoft' : 'local'})…\n`);

  const result = await syncSchoolSharePoint();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
