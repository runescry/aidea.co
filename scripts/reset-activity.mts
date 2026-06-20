#!/usr/bin/env npx tsx
/**
 * Clear activity history (queue, audit, harness runs, chat, brief).
 * Preserves profile/KB, settings, and Nango integrations.
 *
 * Usage:
 *   npm run reset:activity
 */
import { loadEnvLocal } from '../tests/integration/setup';
import { clearActivityHistory } from '../lib/storage';

loadEnvLocal();

async function main(): Promise<void> {
  await clearActivityHistory();
  console.log(
    'Activity history cleared: action queue, audit trail, harness runs, chat, latest brief.',
  );
  console.log('Preserved: profile/KB, app settings, Nango connections.');
  console.log('Also clear browser localStorage keys aidea-chat-v1 and aidea-onboarding-complete if needed.');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
