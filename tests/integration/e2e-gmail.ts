import { nangoConfigured } from '@/lib/nango/client';
import {
  hasNangoConnections,
  listCalendarConnectionsLite,
  listGmailConnectionsLite,
} from '@/lib/nango/connections';
import { readGmailMessages, sendGmailMessage } from '@/lib/nango/gmail';
import { hasValidLlmKey, isIntegrationRun } from './helpers';

export const E2E_SUBJECT_PREFIX = 'aidea-e2e-';

export function isE2eRun(): boolean {
  return isIntegrationRun() && process.env.INTEGRATION_E2E === '1';
}

export function generateE2eSubject(): string {
  return `${E2E_SUBJECT_PREFIX}${Date.now()}`;
}

export async function e2ePrerequisiteReason(): Promise<string | undefined> {
  if (!isE2eRun()) {
    return 'Set RUN_INTEGRATION=1 INTEGRATION_E2E=1 (npm run test:integration:e2e)';
  }
  if (!hasValidLlmKey()) {
    return 'LLM key missing — set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY in .env.local';
  }
  if (!nangoConfigured()) {
    return 'NANGO_SECRET_KEY not configured in .env.local';
  }
  if (!(await hasNangoConnections())) {
    return 'No Nango connections — connect Gmail via Settings → Connect Google';
  }
  const gmail = await listGmailConnectionsLite();
  if (!gmail.some(c => c.email)) {
    return 'Gmail connected but email address unavailable — reconnect Google Mail in Settings';
  }
  return undefined;
}

export async function resolveSelfGmail(): Promise<{ email: string; connectionId: string }> {
  const connections = await listGmailConnectionsLite();
  const conn = connections.find(c => c.email);
  if (!conn?.email) {
    throw new Error('No Gmail connection with email — connect via Settings → Connect Google');
  }
  return { email: conn.email, connectionId: conn.connectionId };
}

export function buildE2eEmailBody(marker: string): string {
  return `aidea E2E test (${marker})

URGENT — action required by today

Please reply confirming receipt of this test message.
This email was sent by the aidea integration test suite.`;
}

export function triageMissionForSubject(subject: string): string {
  return `Triage unread Gmail. ONLY process the email whose subject is exactly "${subject}".
For that email only:
1. Include it in inbox_triage urgent[] with HIGH urgency
2. queue_action type email_reply with a short acknowledgment draft to the sender (replyToMessageId from gmail_read, connectionId from gmail_read)
Ignore all other emails. Complete write_state for inbox_triage.`;
}

export async function sendE2eTestEmail(
  subject: string,
  body: string,
): Promise<{ messageId: string; to: string; connectionId: string; subject: string }> {
  const { email, connectionId } = await resolveSelfGmail();
  const result = await sendGmailMessage({ to: email, subject, body, connectionId });
  return { ...result, to: email, connectionId, subject };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForE2eEmail(
  subject: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<{ id: string; connectionId: string; subject: string }> {
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const intervalMs = options?.intervalMs ?? 4_000;
  const query = `subject:"${subject}" is:unread`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { emails } = await readGmailMessages({ query, maxResults: 5 });
    const match = emails.find(e => e.subject === subject && !e.id.startsWith('error-'));
    if (match) {
      return { id: match.id, connectionId: match.connectionId, subject: match.subject };
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for unread email with subject "${subject}"`);
}

export async function hasCalendarConnection(): Promise<boolean> {
  if (!nangoConfigured()) return false;
  const connections = await listCalendarConnectionsLite();
  return connections.length > 0;
}
