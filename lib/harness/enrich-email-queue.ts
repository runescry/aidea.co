import { readAllKB } from './knowledge-base';
import { getGmailCache } from './inbox-sanitize';
import type { KnowledgeBase } from '@/types/knowledge-base';

const PLACEHOLDER_BODY = /\[(?:your|insert|add|enter)\s+[^\]]+\]/i;
const NOTIFICATION_RELAY = /(?:notifications?@|noreply@|no-reply@|mail\d*\.guide\.co|@email\..*\.com$)/i;

export function parseEmailAddress(header: string): string {
  const match = header.match(/<([^>]+)>/);
  return (match ? match[1] : header).trim();
}

export function isNotificationRelayAddress(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) return false;
  return NOTIFICATION_RELAY.test(trimmed);
}

function normalizeReplySubject(subject: string): string {
  const base = subject.replace(/^(\s*(re|fwd):\s*)+/gi, '').trim();
  return base.toLowerCase().startsWith('re:') ? subject.trim() : `Re: ${base}`;
}

/** Fill routing fields and profile placeholders before enqueueing email replies. */
export async function enrichEmailQueuePayload(
  stateData: Record<string, unknown>,
  payload: Record<string, unknown>,
  summary?: string,
): Promise<Record<string, unknown>> {
  const out = { ...payload };
  const replyId = (out.replyToMessageId ?? out.messageId) as string | undefined;
  const cached = replyId ? getGmailCache(stateData).get(replyId) : undefined;

  if (cached?.connectionId && !out.connectionId) {
    out.connectionId = cached.connectionId;
  }
  if (cached?.threadId && !out.threadId) {
    out.threadId = cached.threadId;
  }

  const replyToHeader = cached?.replyTo ?? cached?.from;
  if (replyToHeader) {
    const senderEmail = parseEmailAddress(replyToHeader);
    const currentTo = typeof out.to === 'string' ? out.to.trim() : '';
    if (!currentTo || isNotificationRelayAddress(currentTo)) {
      out.to = senderEmail;
    }
    const subject = cached?.subject;
    if (!out.subject && subject) {
      out.subject = normalizeReplySubject(subject);
    }
  }

  if (!out.subject && summary) {
    const reMatch = summary.match(/^Reply to .+?:\s*(.+)$/i);
    if (reMatch) out.subject = `Re: ${reMatch[1].trim()}`;
  }

  const kb = await readAllKB() as KnowledgeBase;
  const phone = kb.identity?.phone?.trim();
  const body = typeof out.body === 'string' ? out.body : '';
  if (phone && body) {
    out.body = body.replace(/\[your phone number\]/gi, phone);
  }

  return out;
}

export function validateEmailQueueEnqueue(input: {
  type: string;
  payload: Record<string, unknown>;
  detail?: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.type !== 'email_reply' && input.type !== 'email_send') {
    return { ok: true };
  }

  const body = String(
    input.payload.body ?? input.detail ?? '',
  ).trim();

  if (!body) {
    return { ok: false, error: 'email_reply requires a non-empty body (detail or payload.body)' };
  }

  if (PLACEHOLDER_BODY.test(body)) {
    return { ok: false, error: 'email_reply body still contains placeholders — read identity.phone from kb_read or omit the field' };
  }

  const replyId = (input.payload.replyToMessageId ?? input.payload.messageId) as string | undefined;
  const to = typeof input.payload.to === 'string' ? input.payload.to.trim() : '';

  if (!replyId && !to) {
    return { ok: false, error: 'email_reply requires replyToMessageId or payload.to' };
  }

  if (to && isNotificationRelayAddress(to)) {
    return { ok: false, error: 'email_reply to address looks like a notification relay — use the sender reply-to from gmail_read' };
  }

  return { ok: true };
}
