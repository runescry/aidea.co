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

function parseEmailAddress(header: string): string {
  const match = header.match(/<([^>]+)>/);
  return (match ? match[1] : header).trim();
}

async function getGmailMessageMeta(
  conn: NangoConnectionPublic,
  messageId: string,
): Promise<{
  threadId: string;
  from: string;
  replyTo: string;
  subject: string;
  messageIdHeader: string;
}> {
  const nango = getNango();
  const res = await nango.get<{
    threadId: string;
    payload?: { headers?: Array<{ name: string; value: string }> };
  }>({
    providerConfigKey: gmailIntegrationId(),
    connectionId: conn.connectionId,
    endpoint: `/gmail/v1/users/me/messages/${messageId}`,
    params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Message-ID', 'Reply-To'] },
  });
  const headers = res.data.payload?.headers ?? [];
  const get = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
  return {
    threadId: res.data.threadId,
    from: get('From'),
    replyTo: get('Reply-To') || get('From'),
    subject: get('Subject'),
    messageIdHeader: get('Message-ID'),
  };
}

export async function createGmailDraft(input: {
  to?: string;
  subject?: string;
  body: string;
  replyToMessageId?: string;
  connectionId?: string;
}): Promise<{ draftId: string; messageId: string; subject: string; connectionId: string }> {
  const [conn] = await resolveGmailConnections(input.connectionId);
  const nango = getNango();

  let to = input.to?.trim() ?? '';
  let subject = input.subject?.trim() ?? '';
  let threadId: string | undefined;
  let inReplyTo: string | undefined;

  if (input.replyToMessageId) {
    const meta = await getGmailMessageMeta(conn, input.replyToMessageId);
    threadId = meta.threadId;
    if (!to) to = parseEmailAddress(meta.replyTo);
    if (!subject) {
      const base = meta.subject.replace(/^Re:\s*/i, '').trim();
      subject = base.toLowerCase().startsWith('re:') ? meta.subject : `Re: ${base}`;
    }
    inReplyTo = meta.messageIdHeader || undefined;
  }

  if (!subject) throw new Error('Draft missing subject');
  if (!input.body?.trim()) throw new Error('Draft missing body');

  const headerLines = [
    ...(to ? [`To: ${to}`] : []),
    `Subject: ${subject}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : []),
    'Content-Type: text/plain; charset=utf-8',
    '',
    input.body,
  ];
  const raw = encodeRawEmail(headerLines.join('\r\n'));

  const res = await nango.post<{ id: string; message: { id: string; threadId?: string } }>({
    providerConfigKey: gmailIntegrationId(),
    connectionId: conn.connectionId,
    endpoint: '/gmail/v1/users/me/drafts',
    data: { message: { raw, threadId } },
  });

  return {
    draftId: res.data.id,
    messageId: res.data.message.id,
    subject,
    connectionId: conn.connectionId,
  };
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
