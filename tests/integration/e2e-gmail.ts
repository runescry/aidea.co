import { getNango, gmailIntegrationId, nangoConfigured } from '@/lib/nango/client';
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

export function triageMissionForSubject(
  subject: string,
  messageId: string,
  connectionId: string,
  replyToEmail: string,
): string {
  return `Triage Gmail. ONLY process the email whose subject is exactly "${subject}".
Call gmail_read once with query: in:anywhere subject:"${subject}" (do not use is:unread — self-sent test mail may already be read).
For that email only:
1. Include it in inbox_triage urgent[] with HIGH urgency (messageId from gmail_read, or ${messageId} if missing)
2. queue_action type email_reply with a short acknowledgment draft to the sender
   payload MUST include: to "${replyToEmail}", subject "Re: ${subject}", body (draft text),
   replyToMessageId (from gmail_read or ${messageId}), connectionId (from gmail_read or ${connectionId})
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

function findE2eEmailBySubject(
  emails: Awaited<ReturnType<typeof readGmailMessages>>['emails'],
  subject: string,
): { id: string; connectionId: string; subject: string } | undefined {
  const match = emails.find(e => e.subject === subject && !e.id.startsWith('error-'));
  return match
    ? { id: match.id, connectionId: match.connectionId, subject: match.subject }
    : undefined;
}

async function getGmailMessageById(
  messageId: string,
  connectionId: string,
): Promise<{ id: string; connectionId: string; subject: string } | undefined> {
  try {
    const nango = getNango();
    const res = await nango.get<{
      id: string;
      payload?: { headers?: Array<{ name: string; value: string }> };
    }>({
      providerConfigKey: gmailIntegrationId(),
      connectionId,
      endpoint: `/gmail/v1/users/me/messages/${messageId}`,
      params: { format: 'metadata', metadataHeaders: ['Subject'] },
    });
    const headers = res.data.payload?.headers ?? [];
    const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
    return { id: res.data.id, connectionId, subject };
  } catch {
    return undefined;
  }
}

export async function waitForE2eEmail(
  subject: string,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    /** Sent message id from sendE2eTestEmail — poll inbox copy first; fall back to direct fetch */
    knownMessageId?: string;
    connectionId?: string;
  },
): Promise<{ id: string; connectionId: string; subject: string }> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const intervalMs = options?.intervalMs ?? 4_000;
  const connectionId = options?.connectionId;
  const query = `in:anywhere subject:"${subject}"`;
  const readOpts = { query, maxResults: 5, connectionId };
  const deadline = Date.now() + timeoutMs;

  const searchOnce = async () =>
    findE2eEmailBySubject((await readGmailMessages(readOpts)).emails, subject);

  const inboxCopy = await searchOnce();
  if (inboxCopy && inboxCopy.id !== options?.knownMessageId) return inboxCopy;
  if (inboxCopy) return inboxCopy;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const found = await searchOnce();
    if (found) return found;
  }

  if (options?.knownMessageId && connectionId) {
    const sent = await getGmailMessageById(options.knownMessageId, connectionId);
    if (sent?.subject === subject) return sent;
  }

  throw new Error(
    `Timed out waiting for email with subject "${subject}"`
    + (options?.knownMessageId ? ` (sent messageId ${options.knownMessageId})` : ''),
  );
}

export async function hasCalendarConnection(): Promise<boolean> {
  if (!nangoConfigured()) return false;
  const connections = await listCalendarConnectionsLite();
  return connections.length > 0;
}
