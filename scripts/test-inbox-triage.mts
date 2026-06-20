#!/usr/bin/env npx tsx
/**
 * Run inbox-triage end-to-end and print a validation report.
 *
 * Usage:
 *   npm run test:inbox-triage:run          # dry-run gmail (mock inbox)
 *   INTEGRATION_GMAIL=1 npm run test:inbox-triage:run   # live Gmail via Nango
 */
import { loadEnvLocal } from '../tests/integration/setup';
import { runInboxTriageHarness } from '../lib/harness/inbox-triage-harness';

loadEnvLocal();

const live = process.env.INTEGRATION_GMAIL === '1';

async function main(): Promise<void> {
  console.log(`Inbox triage harness (${live ? 'live Gmail' : 'dry-run'})…\n`);

  const result = await runInboxTriageHarness({
    realWorldMode: live ? 'auto' : 'dry-run',
  });

  console.log(result.report);
  console.log('');

  if (result.inboxTriage && typeof result.inboxTriage === 'object') {
    const triage = result.inboxTriage as Record<string, unknown>;
    const preview = {
      urgent: (triage.urgent as unknown[])?.slice(0, 2),
      actionRequired: (triage.actionRequired as unknown[])?.slice(0, 2),
      fyi: (triage.fyi as unknown[])?.slice(0, 2),
      draftsQueued: triage.draftsQueued,
    };
    console.log('inbox_triage preview:', JSON.stringify(preview, null, 2));
  }

  if (!result.validation.ok) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
