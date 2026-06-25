import { resolveTriageRowEmail, type CachedGmail } from './inbox-sanitize';

/** Default lookback for Daily OS inbox triage and morning brief must-do. */
export const INBOX_LOOKBACK_DAYS = 14;

export function defaultInboxTriageGmailQuery(): string {
  return `newer_than:${INBOX_LOOKBACK_DAYS}d`;
}

export function isEmailClearlyOutsideInboxWindow(dateStr: string, now = new Date()): boolean {
  if (!dateStr?.trim()) return false;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - INBOX_LOOKBACK_DAYS);

  let parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    const match = dateStr.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
    if (match) parsed = new Date(`${match[2]} ${match[1]}, ${match[3]}`);
  }
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed < cutoff;
}

export function isEmailWithinInboxWindow(dateStr: string, now = new Date()): boolean {
  return !isEmailClearlyOutsideInboxWindow(dateStr, now);
}

export function appendInboxWindowToGmailQuery(query: string): string {
  if (/\bnewer_than:/i.test(query)) return query.trim();
  return `${query.trim()} newer_than:${INBOX_LOOKBACK_DAYS}d`.replace(/\s+/g, ' ').trim();
}

export function inboxTriageAgentRoles(): Set<string> {
  return new Set(['inbox-triage', 'daily-lite-briefer']);
}

/** Only flag when the agent summary cites an old embedded forward — not the whole body. */
export function textReferencesStaleForward(text: string, now = new Date()): boolean {
  if (!/\b(forwarded message|begin forwarded message)\b/i.test(text)) return false;
  const cutoffYear = now.getFullYear() - 1;
  for (const match of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\b/g)) {
    if (Number(match[3]) < cutoffYear) return true;
  }
  for (const match of text.matchAll(/\bDate:\s*.+?(20\d{2})\b/gi)) {
    if (Number(match[1]) < cutoffYear) return true;
  }
  return false;
}

export interface InboxTriageRowRef {
  messageId?: unknown;
  subject?: unknown;
  from?: unknown;
  reason?: unknown;
  action?: unknown;
  snippet?: unknown;
}

export function triageRowEligibleForMustDo(
  row: InboxTriageRowRef,
  cache: Map<string, CachedGmail>,
  now = new Date(),
): boolean {
  const email = resolveTriageRowEmail(row as Record<string, unknown>, cache);
  if (!email) return false;
  if (email.date && isEmailClearlyOutsideInboxWindow(email.date, now)) return false;
  const rowText = [row.subject, row.reason, row.action, row.snippet]
    .map(part => String(part ?? ''))
    .join(' ');
  if (textReferencesStaleForward(rowText, now)) return false;
  return true;
}

export function filterTriageListForMustDo<T extends InboxTriageRowRef>(
  list: T[] | undefined,
  cache: Map<string, CachedGmail>,
  now = new Date(),
): T[] {
  return (list ?? []).filter(row => triageRowEligibleForMustDo(row, cache, now));
}
