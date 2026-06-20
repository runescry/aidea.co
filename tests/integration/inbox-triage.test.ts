import { describe, expect, it } from 'vitest';
import { runInboxTriageHarness } from '@/lib/harness/inbox-triage-harness';
import { isIntegrationRun, hasValidLlmKey } from './helpers';

const RUN = isIntegrationRun();
const LIVE_GMAIL = process.env.INTEGRATION_GMAIL === '1';

describe.skipIf(!RUN || !hasValidLlmKey())('inbox triage harness', () => {
  it('completes with valid inbox_triage output (dry-run gmail)', async () => {
    const result = await runInboxTriageHarness({ realWorldMode: 'dry-run' });

    expect(result.events.some(e => e.type === 'entity_complete')).toBe(true);
    expect(result.inboxTriage).toBeTruthy();
    expect(result.validation.ok, result.report).toBe(true);
    expect(result.validation.stats.gmailEmails).toBeGreaterThan(0);
    expect(result.validation.stats.toolsCalled).toContain('gmail_read');
    expect(result.validation.stats.toolsCalled).toContain('write_state');
  }, 180_000);
});

describe.skipIf(!RUN || !hasValidLlmKey() || !LIVE_GMAIL)('inbox triage live gmail', () => {
  it('reads real unread mail and writes inbox_triage', async () => {
    const result = await runInboxTriageHarness({ realWorldMode: 'auto' });

    expect(result.events.some(e => e.type === 'entity_complete')).toBe(true);
    expect(result.inboxTriage).toBeTruthy();

    const gmailTool = result.events.find(
      e => e.type === 'tool_result' && (e.data as { tool?: string }).tool === 'gmail_read',
    );
    const gmailResult = (gmailTool?.data as { result?: { error?: string; emails?: unknown[] } })?.result;
    expect(gmailResult?.error, gmailResult?.error).toBeUndefined();

    expect(result.validation.errors.filter(e => !e.includes('messageId'))).toHaveLength(0);
  }, 300_000);
});
