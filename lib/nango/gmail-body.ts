import { getNango, gmailIntegrationId } from './client';
import { formatGmailApiError } from './gmail-errors';

export const GMAIL_BODY_MAX_CHARS = 12_000;

export interface GmailMimePart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMimePart[];
}

export interface GmailMessagePayload {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMimePart[];
  headers?: Array<{ name: string; value: string }>;
}

function normalizeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return normalized + '='.repeat(padLen);
}

export function decodeBase64Url(data: string): string {
  return Buffer.from(normalizeBase64Url(data), 'base64').toString('utf8');
}

export function decodeBase64UrlBuffer(data: string): Buffer {
  return Buffer.from(normalizeBase64Url(data), 'base64');
}

export function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function extractBodyFromPayload(payload: GmailMessagePayload): { text: string; truncated: boolean } {
  let plainText = '';
  let htmlText = '';

  function walk(part: GmailMimePart): void {
    const mime = (part.mimeType ?? '').toLowerCase();
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (mime === 'text/plain' && !plainText) plainText = decoded;
      else if (mime === 'text/html' && !htmlText) htmlText = decoded;
    }
    for (const child of part.parts ?? []) walk(child);
  }

  const rootMime = (payload.mimeType ?? '').toLowerCase();
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (rootMime === 'text/plain') plainText = decoded;
    else if (rootMime === 'text/html') htmlText = decoded;
  }

  for (const part of payload.parts ?? []) walk(part);

  const raw = plainText || (htmlText ? stripHtmlTags(htmlText) : '');
  const truncated = raw.length > GMAIL_BODY_MAX_CHARS;
  return { text: raw.slice(0, GMAIL_BODY_MAX_CHARS), truncated };
}

export async function getGmailMessageFull(
  messageId: string,
  connectionId: string,
): Promise<{ id: string; snippet: string; payload: GmailMessagePayload }> {
  const nango = getNango();
  try {
    const res = await nango.get<{
      id: string;
      snippet: string;
      payload?: GmailMessagePayload;
    }>({
      providerConfigKey: gmailIntegrationId(),
      connectionId,
      endpoint: `/gmail/v1/users/me/messages/${messageId}`,
      params: { format: 'full' },
    });
    return {
      id: res.data.id,
      snippet: res.data.snippet,
      payload: res.data.payload ?? {},
    };
  } catch (err) {
    throw new Error(formatGmailApiError(err, 'read'));
  }
}

export async function fetchGmailBodyText(
  messageId: string,
  connectionId: string,
): Promise<{ text: string; truncated: boolean }> {
  const full = await getGmailMessageFull(messageId, connectionId);
  return extractBodyFromPayload(full.payload);
}
