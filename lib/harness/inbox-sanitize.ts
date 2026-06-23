/** Gmail rows cached from gmail_read — source of truth for triage attribution. */
import { gmailMessageUrl } from '@/lib/gmail/message-url';

export interface CachedGmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  account?: string;
  connectionId?: string;
}

export interface InboxTriagePayload {
  urgent?: unknown[];
  actionRequired?: unknown[];
  fyi?: unknown[];
  profileUpdatesQueued?: number;
  profileUpdatesApplied?: number;
  draftsQueued?: number;
  [key: string]: unknown;
}

const CHILD_NAMES = ['sebastian', 'ivy'] as const;

/** School senders → child names that may appear in that school's emails. */
const SCHOOL_CHILD_MAP: Array<{ match: RegExp; allowedChildren: string[] }> = [
  { match: /genazzano/i, allowedChildren: ['ivy'] },
  { match: /mlc/i, allowedChildren: ['ivy'] },
  { match: /xavier/i, allowedChildren: ['sebastian'] },
];

function childNamesInText(text: string): string[] {
  const lower = text.toLowerCase();
  return CHILD_NAMES.filter(name => lower.includes(name));
}

function findCachedEmail(
  item: Record<string, unknown>,
  cache: Map<string, CachedGmail>,
): CachedGmail | undefined {
  const messageId = item.messageId ? String(item.messageId) : '';
  if (messageId && cache.has(messageId)) return cache.get(messageId);

  const subject = String(item.subject ?? '').trim().toLowerCase();
  if (subject) {
    const bySubject = [...cache.values()].filter(
      e => e.subject.trim().toLowerCase() === subject,
    );
    if (bySubject.length === 1) return bySubject[0];
  }

  const fromHint = String(item.from ?? '').trim().toLowerCase();
  if (fromHint.length >= 4) {
    const byFrom = [...cache.values()].filter(e => e.from.toLowerCase().includes(fromHint.slice(0, 24)));
    if (byFrom.length === 1) return byFrom[0];
  }

  return undefined;
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

export function sanitizeTriageItem(
  item: unknown,
  cache: Map<string, CachedGmail>,
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
  }

  const sourceText = email ? `${email.from} ${email.subject} ${email.snippet}` : '';
  const summaryText = `${String(out.reason ?? '')} ${String(out.action ?? '')}`;
  const orphans = orphanChildNames(sourceText, summaryText);
  const schoolMismatch = email
    ? schoolAttributionViolation(email.from, email.subject, summaryText)
    : false;

  if (email && (orphans.length > 0 || schoolMismatch)) {
    out.reason = email.snippet.slice(0, 220);
    if (!String(out.action ?? '').trim()) {
      out.action = 'Review this email';
    }
    out.attributionWarning =
      orphans.length > 0
        ? `Reset summary — ${orphans.join(', ')} not mentioned in this email`
        : 'Reset summary — school/child names did not match sender';
  }

  const messageId = out.messageId ? String(out.messageId) : '';
  if (messageId) out.gmailUrl = gmailMessageUrl(messageId);

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
  return items.map(item => {
    if (!item || typeof item !== 'object') return {};
    const raw = item as Record<string, unknown>;
    const email = findCachedEmail(raw, cache);
    const out: InboxSummaryRow = { ...(raw as InboxSummaryRow) };
    if (email) {
      out.from = email.from;
      out.subject = email.subject;
      out.snippet = email.snippet;
      out.messageId = email.id;
    }
    const messageId = out.messageId ?? (raw.messageId ? String(raw.messageId) : '');
    if (messageId) {
      out.messageId = messageId;
      out.gmailUrl = gmailMessageUrl(messageId);
    }
    return out;
  });
}

export function sanitizeInboxTriage(
  triage: unknown,
  cache: Map<string, CachedGmail>,
): InboxTriagePayload {
  if (!triage || typeof triage !== 'object') return {};
  const src = triage as InboxTriagePayload;

  const sanitizeList = (list: unknown[] | undefined) =>
    (list ?? []).map(item => sanitizeTriageItem(item, cache));

  return {
    ...src,
    urgent: sanitizeList(src.urgent as unknown[] | undefined),
    actionRequired: sanitizeList(src.actionRequired as unknown[] | undefined),
    fyi: sanitizeList(src.fyi as unknown[] | undefined),
  };
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
