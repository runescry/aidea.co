import { getNango, gmailIntegrationId } from './client';
import { decodeBase64UrlBuffer, type GmailMessagePayload } from './gmail-body';
import { formatGmailApiError } from './gmail-errors';

export const GMAIL_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const GMAIL_ATTACHMENT_MAX_PER_CALL = 2;

export interface GmailAttachmentMeta {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface MimePartWithFilename {
  mimeType?: string;
  filename?: string;
  body?: { attachmentId?: string; size?: number };
  parts?: MimePartWithFilename[];
}

export function listAttachmentsFromPayload(payload: GmailMessagePayload): GmailAttachmentMeta[] {
  const out: GmailAttachmentMeta[] = [];

  function walk(part: MimePartWithFilename): void {
    const attachmentId = part.body?.attachmentId;
    if (attachmentId) {
      out.push({
        attachmentId,
        filename: part.filename ?? 'attachment',
        mimeType: part.mimeType ?? 'application/octet-stream',
        size: part.body?.size ?? 0,
      });
    }
    for (const child of part.parts ?? []) walk(child);
  }

  for (const part of (payload as MimePartWithFilename).parts ?? []) walk(part);
  return out;
}

export async function fetchGmailAttachmentBytes(
  messageId: string,
  attachmentId: string,
  connectionId: string,
): Promise<Buffer> {
  const nango = getNango();
  try {
    const res = await nango.get<{ data?: string; size?: number }>({
      providerConfigKey: gmailIntegrationId(),
      connectionId,
      endpoint: `/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    });
    if (!res.data.data) throw new Error('Attachment data missing from Gmail API');
    return decodeBase64UrlBuffer(res.data.data);
  } catch (err) {
    throw new Error(formatGmailApiError(err, 'read'));
  }
}

export interface FetchedGmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  text: string;
  truncated: boolean;
  skipped?: string;
}

export async function fetchGmailAttachments(input: {
  messageId: string;
  connectionId: string;
  maxAttachments?: number;
  maxSizeBytes?: number;
  extractText: (bytes: Buffer, mimeType: string, filename?: string) => Promise<{ text: string; truncated: boolean }>;
  payload?: GmailMessagePayload;
}): Promise<{ attachments: FetchedGmailAttachment[]; skipped: Array<{ filename: string; reason: string }> }> {
  const maxAttachments = input.maxAttachments ?? GMAIL_ATTACHMENT_MAX_PER_CALL;
  const maxSizeBytes = input.maxSizeBytes ?? GMAIL_ATTACHMENT_MAX_BYTES;

  let payload = input.payload;
  if (!payload) {
    const nango = getNango();
    const res = await nango.get<{ payload?: GmailMessagePayload }>({
      providerConfigKey: gmailIntegrationId(),
      connectionId: input.connectionId,
      endpoint: `/gmail/v1/users/me/messages/${input.messageId}`,
      params: { format: 'full' },
    });
    payload = res.data.payload ?? {};
  }

  const listed = listAttachmentsFromPayload(payload);
  const attachments: FetchedGmailAttachment[] = [];
  const skipped: Array<{ filename: string; reason: string }> = [];

  for (const meta of listed) {
    if (attachments.length >= maxAttachments) {
      skipped.push({ filename: meta.filename, reason: `max ${maxAttachments} attachments per call` });
      continue;
    }
    if (meta.size > maxSizeBytes) {
      skipped.push({ filename: meta.filename, reason: `size ${meta.size} exceeds ${maxSizeBytes} byte limit` });
      continue;
    }

    try {
      const bytes = await fetchGmailAttachmentBytes(input.messageId, meta.attachmentId, input.connectionId);
      const extracted = await input.extractText(bytes, meta.mimeType, meta.filename);
      attachments.push({
        filename: meta.filename,
        mimeType: meta.mimeType,
        size: meta.size,
        text: extracted.text,
        truncated: extracted.truncated,
      });
    } catch (err) {
      skipped.push({
        filename: meta.filename,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { attachments, skipped };
}
