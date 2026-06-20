import { getNango, gmailIntegrationId } from './client';
import { resolveGmailConnections, type NangoConnectionPublic } from './connections';

export interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  connectionId: string;
  account?: string;
}

async function readGmailForConnection(
  conn: NangoConnectionPublic,
  options: { query: string; maxResults: number },
): Promise<GmailMessage[]> {
  const nango = getNango();
  const integrationId = gmailIntegrationId();

  const listRes = await nango.get<{ messages?: Array<{ id: string }> }>({
    providerConfigKey: integrationId,
    connectionId: conn.connectionId,
    endpoint: '/gmail/v1/users/me/messages',
    params: { q: options.query, maxResults: options.maxResults },
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  const details = await Promise.all(
    messages.map(m =>
      nango.get<{
        id: string;
        snippet: string;
        labelIds?: string[];
        payload?: { headers?: Array<{ name: string; value: string }> };
      }>({
        providerConfigKey: integrationId,
        connectionId: conn.connectionId,
        endpoint: `/gmail/v1/users/me/messages/${m.id}`,
        params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] },
      }).then(msgRes => {
        const msg = msgRes.data;
        const headers = msg.payload?.headers ?? [];
        const get = (name: string) => headers.find(h => h.name === name)?.value ?? '';
        return {
          id: msg.id,
          from: get('From'),
          subject: get('Subject'),
          date: get('Date'),
          snippet: msg.snippet,
          isUnread: (msg.labelIds ?? []).includes('UNREAD'),
          connectionId: conn.connectionId,
          account: conn.email,
        } satisfies GmailMessage;
      }),
    ),
  );

  return details;
}

export async function readGmailMessages(options: {
  query?: string;
  maxResults?: number;
  connectionId?: string;
}): Promise<{ emails: GmailMessage[]; query: string; connections: string[] }> {
  const { query = 'is:unread', maxResults = 10, connectionId } = options;
  const connections = await resolveGmailConnections(connectionId);

  const batches = await Promise.all(
    connections.map(async conn => {
      try {
        return await readGmailForConnection(conn, { query, maxResults });
      } catch (err) {
        return [{
          id: `error-${conn.connectionId}`,
          from: 'aidea',
          subject: `Failed to read Gmail (${conn.connectionId})`,
          date: new Date().toISOString(),
          snippet: err instanceof Error ? err.message : String(err),
          isUnread: false,
          connectionId: conn.connectionId,
          account: conn.email,
        }];
      }
    }),
  );

  const emails = batches.flat();
  return {
    emails,
    query,
    connections: connections.map(c => c.connectionId),
  };
}

function encodeRawEmail(raw: string): string {
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  body: string;
  connectionId?: string;
}): Promise<{ messageId: string; to: string; subject: string; connectionId: string }> {
  const [conn] = await resolveGmailConnections(input.connectionId);
  const nango = getNango();
  const raw = encodeRawEmail(
    `To: ${input.to}\r\nSubject: ${input.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${input.body}`,
  );

  const res = await nango.post<{ id: string }>({
    providerConfigKey: gmailIntegrationId(),
    connectionId: conn.connectionId,
    endpoint: '/gmail/v1/users/me/messages/send',
    data: { raw },
  });

  return {
    messageId: res.data.id,
    to: input.to,
    subject: input.subject,
    connectionId: conn.connectionId,
  };
}
