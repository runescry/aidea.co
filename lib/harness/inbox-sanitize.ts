/** Gmail rows cached from gmail_read — source of truth for triage attribution. */
import { gmailMessageUrl, gmailMessageUrlFromEmail } from '@/lib/gmail/message-url';
import { bundleSchoolTriage } from './school-roundup';

export interface CachedGmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date?: string;
  bodyText?: string;
  threadId?: string;
  replyTo?: string;
  account?: string;
  connectionId?: string;
}

export interface CachedGmailAttachment {
  text: string;
  filenames: string[];
}

export interface InboxTriagePayload {
  urgent?: unknown[];
  actionRequired?: unknown[];
  fyi?: unknown[];
  schoolRoundups?: unknown[];
  profileUpdatesQueued?: number;
  profileUpdatesApplied?: number;
  draftsQueued?: number;
  [key: string]: unknown;
}

const CHILD_NAMES = ['sebastian', 'ivy'] as const;

/** School senders → child names that may appear in that school's emails. */
const SCHOOL_CHILD_MAP: Array<{ match: RegExp; allowedChildren: string[] }> = [
  { match: /genazzano/i, allowedChildren: ['ivy'] },
  { match: /xavier/i, allowedChildren: ['sebastian'] },
];

function childNamesInText(text: string): string[] {
  const lower = text.toLowerCase();
  return CHILD_NAMES.filter(name => lower.includes(name));
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^\s*(re|fwd):\s*/gi, '').trim().toLowerCase();
}

function senderAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

export function resolveTriageRowEmail(
  item: Record<string, unknown>,
  cache: Map<string, CachedGmail>,
): CachedGmail | undefined {
  const messageId = item.messageId ? String(item.messageId) : '';
  if (messageId && cache.has(messageId)) return cache.get(messageId);
  return findCachedEmail(item, cache);
}

function findCachedEmail(
  item: Record<string, unknown>,
  cache: Map<string, CachedGmail>,
): CachedGmail | undefined {
  const messageId = item.messageId ? String(item.messageId) : '';
  if (messageId && cache.has(messageId)) return cache.get(messageId);

  const subject = String(item.subject ?? '').trim();
  const normSubject = normalizeSubject(subject);
  if (normSubject) {
    const bySubject = [...cache.values()].filter(
      e => normalizeSubject(e.subject) === normSubject,
    );
    if (bySubject.length === 1) return bySubject[0];

    const byPartial = [...cache.values()].filter(e => {
      const cached = normalizeSubject(e.subject);
      return cached.includes(normSubject) || normSubject.includes(cached);
    });
    if (byPartial.length === 1) return byPartial[0];
  }

  const fromHint = String(item.from ?? '').trim();
  const address = senderAddress(fromHint);
  if (address.includes('@')) {
    const byAddress = [...cache.values()].filter(e => senderAddress(e.from) === address);
    if (byAddress.length === 1) return byAddress[0];
  }

  const fromLower = fromHint.toLowerCase();
  if (fromLower.length >= 4) {
    const byFrom = [...cache.values()].filter(e => e.from.toLowerCase().includes(fromLower.slice(0, 24)));
    if (byFrom.length === 1) return byFrom[0];
  }

  const snippet = String(item.snippet ?? '').trim().toLowerCase();
  if (snippet.length >= 12) {
    const bySnippet = [...cache.values()].filter(e => e.snippet.toLowerCase().includes(snippet.slice(0, 40)));
    if (bySnippet.length === 1) return bySnippet[0];
  }

  return undefined;
}

function applyEmailToRow(row: InboxSummaryRow, email: CachedGmail): InboxSummaryRow {
  return {
    ...row,
    from: row.from ?? email.from,
    subject: row.subject ?? email.subject,
    snippet: row.snippet ?? email.snippet,
    messageId: email.id,
    gmailUrl: gmailMessageUrlFromEmail(email),
  };
}

function orphanChildNames(sourceText: string, summaryText: string): string[] {
  const inSummary = childNamesInText(summaryText);
  const inSource = childNamesInText(sourceText);
  return inSummary.filter(name => !inSource.includes(name));
}

function schoolAttributionViolation(from: string, subject: string, summaryText: string): boolean {
  const header = `${from} ${subject}`.toLowerCase();
  const names = childNamesInText(summaryText);
  for (const { match, allowedChildren } of SCHOOL_CHILD_MAP) {
    if (!match.test(header)) continue;
    if (names.some(n => !allowedChildren.includes(n))) return true;
  }
  return false;
}

function attachmentSourceExcerpt(
  messageId: string,
  attachmentCache?: Map<string, CachedGmailAttachment>,
): string {
  if (!messageId || !attachmentCache) return '';
  const cached = attachmentCache.get(messageId);
  if (!cached?.text) return '';
  return cached.text.slice(0, 800);
}

export function sanitizeTriageItem(
  item: unknown,
  cache: Map<string, CachedGmail>,
  attachmentCache?: Map<string, CachedGmailAttachment>,
): Record<string, unknown> {
  if (!item || typeof item !== 'object') return { summary: String(item ?? '') };
  const raw = item as Record<string, unknown>;
  const email = findCachedEmail(raw, cache);

  const out: Record<string, unknown> = { ...raw };
  if (email) {
    out.from = email.from;
    out.subject = email.subject;
    out.messageId = email.id;
    out.snippet = email.snippet;
    if (email.account) out.account = email.account;
    if (email.threadId) out.threadId = email.threadId;
  }

  const messageIdForSource = email?.id ?? (raw.messageId ? String(raw.messageId) : '');
  const attachmentText = attachmentSourceExcerpt(messageIdForSource, attachmentCache);
  const bodySource = email?.bodyText ?? email?.snippet ?? '';
  const sourceText = email
    ? `${email.from} ${email.subject} ${bodySource}${attachmentText ? ` ${attachmentText}` : ''}`
    : '';
  const summaryText = `${String(out.reason ?? '')} ${String(out.action ?? '')}`;
  const orphans = orphanChildNames(sourceText, summaryText);
  const schoolMismatch = email
    ? schoolAttributionViolation(email.from, email.subject, summaryText)
    : false;

  if (email && (orphans.length > 0 || schoolMismatch)) {
    const resetSource = email.bodyText?.slice(0, 220) ?? email.snippet.slice(0, 220);
    out.reason = resetSource;
    if (!String(out.action ?? '').trim()) {
      out.action = 'Review this email';
    }
    out.attributionWarning =
      orphans.length > 0
        ? `Reset summary — ${orphans.join(', ')} not mentioned in this email`
        : 'Reset summary — school/child names did not match sender';
  }

  const messageId = out.messageId ? String(out.messageId) : '';
  if (messageId) out.gmailUrl = gmailMessageUrlFromEmail({
    id: messageId,
    threadId: email?.threadId ?? (raw.threadId ? String(raw.threadId) : undefined),
    account: email?.account ?? (raw.account ? String(raw.account) : undefined),
  });

  return out;
}

export type InboxSummaryRow = {
  priority?: string;
  from?: string;
  subject?: string;
  snippet?: string;
  messageId?: string;
  gmailUrl?: string;
};

/** Attach messageId + gmailUrl from gmail_read cache when dispatch search omits ids. */
export function enrichInboxSummary(
  items: unknown[],
  cache: Map<string, CachedGmail>,
): InboxSummaryRow[] {
  const usedIds = new Set<string>();
  const rows = items.map(item => {
    if (!item || typeof item !== 'object') return {};
    const raw = item as Record<string, unknown>;
    const email = findCachedEmail(raw, cache);
    const out: InboxSummaryRow = { ...(raw as InboxSummaryRow) };
    if (email) {
      usedIds.add(email.id);
      return applyEmailToRow(out, email);
    }
    const messageId = out.messageId ?? (raw.messageId ? String(raw.messageId) : '');
    if (messageId) {
      out.messageId = messageId;
      const cached = cache.get(messageId);
      out.gmailUrl = gmailMessageUrlFromEmail({
        id: messageId,
        threadId: cached?.threadId,
        account: cached?.account,
      });
    }
    return out;
  });

  const unused = [...cache.values()].filter(e => !usedIds.has(e.id) && !e.id.startsWith('error-'));
  if (unused.length === 0) return rows;

  let fallbackIdx = 0;
  return rows.map(row => {
    if (row.gmailUrl) return row;
    if (items.length !== cache.size || fallbackIdx >= unused.length) return row;
    const email = unused[fallbackIdx++]!;
    usedIds.add(email.id);
    return applyEmailToRow(row, email);
  });
}

/** Enrich dispatch_response inbox rows from the session gmail_read cache. */
export function enrichDispatchResponse(
  value: unknown,
  stateData: Record<string, unknown>,
): unknown {
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.inbox_summary) || obj.inbox_summary.length === 0) return value;
  return {
    ...obj,
    inbox_summary: enrichInboxSummary(obj.inbox_summary, getGmailCache(stateData)),
  };
}

export function sanitizeInboxTriage(
  triage: unknown,
  cache: Map<string, CachedGmail>,
  stateData?: Record<string, unknown>,
): InboxTriagePayload {
  if (!triage || typeof triage !== 'object') return {};
  const src = triage as InboxTriagePayload;
  const attachmentCache = stateData ? getGmailAttachmentCache(stateData) : undefined;

  const sanitizeList = (list: unknown[] | undefined) =>
    (list ?? []).map(item => sanitizeTriageItem(item, cache, attachmentCache));

  return bundleSchoolTriage({
    ...src,
    urgent: sanitizeList(src.urgent as unknown[] | undefined),
    actionRequired: sanitizeList(src.actionRequired as unknown[] | undefined),
    fyi: sanitizeList(src.fyi as unknown[] | undefined),
  }, cache);
}

export function cacheGmailRead(
  stateData: Record<string, unknown>,
  emails: CachedGmail[],
): void {
  const existing = (stateData._gmailById as Record<string, CachedGmail> | undefined) ?? {};
  const merged = { ...existing };
  for (const email of emails) {
    if (email.id && !email.id.startsWith('error-')) {
      merged[email.id] = email;
    }
  }
  stateData._gmailById = merged;
}

export function getGmailCache(stateData: Record<string, unknown>): Map<string, CachedGmail> {
  const raw = stateData._gmailById as Record<string, CachedGmail> | undefined;
  return new Map(Object.entries(raw ?? {}));
}

export function getGmailConnectionForMessage(
  stateData: Record<string, unknown>,
  messageId: string,
): string | undefined {
  const raw = stateData._gmailById as Record<string, CachedGmail> | undefined;
  return raw?.[messageId]?.connectionId;
}

export function cacheGmailAttachmentText(
  stateData: Record<string, unknown>,
  messageId: string,
  text: string,
  filenames: string[],
): void {
  const existing = (stateData._gmailAttachmentTextByMessageId as Record<string, CachedGmailAttachment> | undefined) ?? {};
  const prior = existing[messageId];
  const mergedFilenames = [...new Set([...(prior?.filenames ?? []), ...filenames])];
  const mergedText = prior?.text ? `${prior.text}\n\n${text}` : text;
  stateData._gmailAttachmentTextByMessageId = {
    ...existing,
    [messageId]: { text: mergedText.slice(0, 8000), filenames: mergedFilenames },
  };
}

export function getGmailAttachmentCache(
  stateData: Record<string, unknown>,
): Map<string, CachedGmailAttachment> {
  const raw = stateData._gmailAttachmentTextByMessageId as Record<string, CachedGmailAttachment> | undefined;
  return new Map(Object.entries(raw ?? {}));
}

export function getGmailAttachmentText(
  stateData: Record<string, unknown>,
  messageId: string,
): string | undefined {
  return (stateData._gmailAttachmentTextByMessageId as Record<string, CachedGmailAttachment> | undefined)?.[messageId]?.text;
}
