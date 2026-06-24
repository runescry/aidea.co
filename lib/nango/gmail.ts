import { getNango, gmailIntegrationId } from './client';
import { resolveGmailConnections, listGmailConnectionsLite, type NangoConnectionPublic } from './connections';
import { formatGmailApiError, isGmailForbidden } from './gmail-errors';
import { extractBodyFromPayload, getGmailMessageFull } from './gmail-body';

export interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  connectionId: string;
  account?: string;
  threadId?: string;
  replyTo?: string;
  bodyText?: string;
  bodyTruncated?: boolean;
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
        threadId: string;
        snippet: string;
        labelIds?: string[];
        payload?: { headers?: Array<{ name: string; value: string }> };
      }>({
        providerConfigKey: integrationId,
        connectionId: conn.connectionId,
        endpoint: `/gmail/v1/users/me/messages/${m.id}`,
        params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date', 'Reply-To'] },
      }).then(msgRes => {
        const msg = msgRes.data;
        const headers = msg.payload?.headers ?? [];
        const get = (name: string) => headers.find(h => h.name === name)?.value ?? '';
        const from = get('From');
        return {
          id: msg.id,
          from,
          subject: get('Subject'),
          date: get('Date'),
          snippet: msg.snippet,
          isUnread: (msg.labelIds ?? []).includes('UNREAD'),
          connectionId: conn.connectionId,
          account: conn.email,
          threadId: msg.threadId,
          replyTo: get('Reply-To') || from,
        } satisfies GmailMessage;
      }),
    ),
  );

  return details;
}

async function fetchGmailMessageById(
  conn: NangoConnectionPublic,
  messageId: string,
  includeBody: boolean,
): Promise<GmailMessage | null> {
  const nango = getNango();
  const integrationId = gmailIntegrationId();

  try {
    const msgRes = await nango.get<{
      id: string;
      threadId: string;
      snippet: string;
      labelIds?: string[];
      payload?: { headers?: Array<{ name: string; value: string }> };
    }>({
      providerConfigKey: integrationId,
      connectionId: conn.connectionId,
      endpoint: `/gmail/v1/users/me/messages/${messageId}`,
      params: includeBody
        ? { format: 'full' }
        : { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date', 'Reply-To'] },
    });

    const msg = msgRes.data;
    const headers = msg.payload?.headers ?? [];
    const get = (name: string) => headers.find(h => h.name === name)?.value ?? '';
    const from = get('From');

    let bodyText: string | undefined;
    let bodyTruncated: boolean | undefined;
    if (includeBody && msg.payload) {
      const extracted = extractBodyFromPayload(msg.payload);
      bodyText = extracted.text;
      bodyTruncated = extracted.truncated;
    }

    return {
      id: msg.id,
      from,
      subject: get('Subject'),
      date: get('Date'),
      snippet: msg.snippet,
      isUnread: (msg.labelIds ?? []).includes('UNREAD'),
      connectionId: conn.connectionId,
      account: conn.email,
      threadId: msg.threadId,
      replyTo: get('Reply-To') || from,
      bodyText,
      bodyTruncated,
    };
  } catch {
    return null;
  }
}

export async function readGmailMessagesByIds(options: {
  messageIds: string[];
  connectionId?: string;
  includeBody?: boolean;
}): Promise<GmailMessage[]> {
  const { messageIds, connectionId, includeBody = true } = options;
  const connections = await resolveGmailConnections(connectionId);
  const results: GmailMessage[] = [];

  for (const messageId of messageIds) {
    let found: GmailMessage | null = null;
    for (const conn of connections) {
      found = await fetchGmailMessageById(conn, messageId, includeBody);
      if (found) break;
    }
    if (found) results.push(found);
  }

  return results;
}

export async function enrichGmailMessagesWithBodies(emails: GmailMessage[]): Promise<GmailMessage[]> {
  return Promise.all(emails.map(async email => {
    if (email.id.startsWith('error-') || email.bodyText) return email;
    try {
      const full = await getGmailMessageFull(email.id, email.connectionId);
      const extracted = extractBodyFromPayload(full.payload);
      return { ...email, bodyText: extracted.text, bodyTruncated: extracted.truncated };
    } catch {
      return email;
    }
  }));
}

export async function readGmailMessages(options: {
  query?: string;
  maxResults?: number;
  connectionId?: string;
  includeBody?: boolean;
  messageIds?: string[];
}): Promise<{ emails: GmailMessage[]; query: string; connections: string[] }> {
  const { query = 'is:unread', maxResults = 10, connectionId, includeBody = false, messageIds } = options;
  const connections = await resolveGmailConnections(connectionId);

  let emails: GmailMessage[] = [];

  if (messageIds?.length) {
    emails = await readGmailMessagesByIds({ messageIds, connectionId, includeBody });
  }

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

  const listed = batches.flat();
  const seen = new Set(emails.map(e => e.id));
  for (const email of listed) {
    if (!seen.has(email.id)) {
      emails.push(email);
      seen.add(email.id);
    }
  }

  if (includeBody) {
    emails = await enrichGmailMessagesWithBodies(emails);
  }

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

function buildEmailHeaderLines(input: {
  to?: string;
  cc?: string;
  subject: string;
  inReplyTo?: string;
}): string[] {
  return [
    ...(input.to ? [`To: ${input.to}`] : []),
    ...(input.cc ? [`Cc: ${input.cc}`] : []),
    `Subject: ${input.subject}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`] : []),
    'Content-Type: text/plain; charset=utf-8',
    '',
  ];
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
  try {
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
  } catch (err) {
    throw new Error(formatGmailApiError(err, 'read'));
  }
}

async function resolveConnectionForReply(
  messageId: string,
  preferredConnectionId?: string,
): Promise<{ conn: NangoConnectionPublic; meta: Awaited<ReturnType<typeof getGmailMessageMeta>> }> {
  const connections = await listGmailConnectionsLite();
  if (connections.length === 0) {
    throw new Error('Gmail not connected — use Settings → Connect Google Mail');
  }

  const ordered = preferredConnectionId
    ? [
        ...connections.filter(c => c.connectionId === preferredConnectionId),
        ...connections.filter(c => c.connectionId !== preferredConnectionId),
      ]
    : connections;

  let lastErr: unknown;
  for (const conn of ordered) {
    try {
      const meta = await getGmailMessageMeta(conn, messageId);
      return { conn, meta };
    } catch (err) {
      lastErr = err;
      if (!isGmailForbidden(err) && !/not found/i.test(String(err))) throw err;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('Could not access this email on any connected Gmail account');
}

export async function createGmailDraft(input: {
  to?: string;
  cc?: string;
  subject?: string;
  body: string;
  replyToMessageId?: string;
  connectionId?: string;
}): Promise<{ draftId: string; messageId: string; subject: string; connectionId: string }> {
  const nango = getNango();

  let conn: NangoConnectionPublic;
  let to = input.to?.trim() ?? '';
  let subject = input.subject?.trim() ?? '';
  let threadId: string | undefined;
  let inReplyTo: string | undefined;

  if (input.replyToMessageId) {
    const resolved = await resolveConnectionForReply(input.replyToMessageId, input.connectionId);
    conn = resolved.conn;
    const meta = resolved.meta;
    threadId = meta.threadId;
    if (!to) to = parseEmailAddress(meta.replyTo);
    if (!subject) {
      const base = meta.subject.replace(/^Re:\s*/i, '').trim();
      subject = base.toLowerCase().startsWith('re:') ? meta.subject : `Re: ${base}`;
    }
    inReplyTo = meta.messageIdHeader || undefined;
  } else {
    [conn] = await resolveGmailConnections(input.connectionId);
  }

  if (!subject) throw new Error('Draft missing subject');
  if (!input.body?.trim()) throw new Error('Draft missing body');

  const headerLines = buildEmailHeaderLines({
    to: to || undefined,
    cc: input.cc?.trim() || undefined,
    subject,
    inReplyTo,
  });
  const raw = encodeRawEmail([...headerLines, input.body].join('\r\n'));

  try {
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
  } catch (err) {
    throw new Error(formatGmailApiError(err, 'draft'));
  }
}

export async function sendGmailMessage(input: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  connectionId?: string;
}): Promise<{ messageId: string; to: string; subject: string; connectionId: string }> {
  const [conn] = await resolveGmailConnections(input.connectionId);
  const nango = getNango();
  const headerLines = buildEmailHeaderLines({
    to: input.to,
    cc: input.cc?.trim() || undefined,
    subject: input.subject,
  });
  const raw = encodeRawEmail([...headerLines, input.body].join('\r\n'));

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
