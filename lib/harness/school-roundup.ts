import type { CachedGmail } from './inbox-sanitize';
import type { InboxTriagePayload } from './inbox-sanitize';
import { gmailMessageUrl } from '@/lib/gmail/message-url';

const SCHOOL_SENDERS: Array<{ match: RegExp; school: string; child: string }> = [
  { match: /genazzano/i, school: 'Genazzano', child: 'Ivy' },
  { match: /\bmlc\b/i, school: 'MLC', child: 'Ivy' },
  { match: /xavier/i, school: 'Xavier College', child: 'Sebastian' },
];

const ACTION_HINT = /\b(reply|confirm|return|submit|sign|pay|rsvp|permission|deadline|by \w+day|asap|urgent|action required)\b/i;
const GENERIC_ACTION = /^(review this email|read email|check email)$/i;

export interface SchoolRoundupItem {
  subject: string;
  reason: string;
  action?: string;
  messageId?: string;
  gmailUrl?: string;
  queueActionId?: string;
}

export interface SchoolRoundup {
  school: string;
  child: string;
  emailCount: number;
  needsYou: SchoolRoundupItem[];
  fyi: SchoolRoundupItem[];
  messageIds: string[];
}

export function schoolFromSender(from: string): { school: string; child: string } | null {
  for (const { match, school, child } of SCHOOL_SENDERS) {
    if (match.test(from)) return { school, child };
  }
  return null;
}

function asRow(item: unknown): Record<string, unknown> | null {
  return item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
}

function rowSchoolKey(row: Record<string, unknown>, cache: Map<string, CachedGmail>): string | null {
  const from = String(row.from ?? '');
  const messageId = row.messageId ? String(row.messageId) : '';
  const cached = messageId ? cache.get(messageId) : undefined;
  const header = `${from} ${cached?.from ?? ''}`;
  const match = schoolFromSender(header);
  return match ? `${match.school}:${match.child}` : null;
}

function isActionableSchoolRow(row: Record<string, unknown>): boolean {
  if (row.queueActionId) return true;
  const urgency = String(row.urgency ?? '').toUpperCase();
  if (urgency === 'HIGH') return true;
  const action = String(row.action ?? '').trim();
  if (action && !GENERIC_ACTION.test(action)) return true;
  const text = `${row.subject ?? ''} ${row.reason ?? ''} ${row.snippet ?? ''}`;
  return ACTION_HINT.test(text);
}

function toRoundupItem(
  row: Record<string, unknown>,
  cache: Map<string, CachedGmail>,
): SchoolRoundupItem {
  const messageId = row.messageId ? String(row.messageId) : undefined;
  const cached = messageId ? cache.get(messageId) : undefined;
  return {
    subject: String(row.subject ?? cached?.subject ?? 'School email'),
    reason: String(row.reason ?? row.snippet ?? cached?.snippet ?? '').trim(),
    action: row.action ? String(row.action) : undefined,
    messageId,
    gmailUrl: messageId ? gmailMessageUrl(messageId) : undefined,
    queueActionId: row.queueActionId ? String(row.queueActionId) : undefined,
  };
}

type TaggedRow = { list: 'urgent' | 'actionRequired' | 'fyi'; index: number; row: Record<string, unknown> };

/** Collapse 2+ same-school emails into schoolRoundups + one actionRequired summary row. */
export function bundleSchoolTriage(
  triage: InboxTriagePayload,
  cache: Map<string, CachedGmail>,
  minEmails = 2,
): InboxTriagePayload {
  const urgent = [...(triage.urgent ?? [])];
  const actionRequired = [...(triage.actionRequired ?? [])];
  const fyi = [...(triage.fyi ?? [])];

  const tagged: TaggedRow[] = [];
  urgent.forEach((item, index) => {
    const row = asRow(item);
    if (row) tagged.push({ list: 'urgent', index, row });
  });
  actionRequired.forEach((item, index) => {
    const row = asRow(item);
    if (row) tagged.push({ list: 'actionRequired', index, row });
  });
  fyi.forEach((item, index) => {
    const row = asRow(item);
    if (row) tagged.push({ list: 'fyi', index, row });
  });

  const bySchool = new Map<string, TaggedRow[]>();
  for (const entry of tagged) {
    const key = rowSchoolKey(entry.row, cache);
    if (!key) continue;
    const list = bySchool.get(key) ?? [];
    list.push(entry);
    bySchool.set(key, list);
  }

  const schoolRoundups: SchoolRoundup[] = [];
  const removeSets = {
    urgent: new Set<number>(),
    actionRequired: new Set<number>(),
    fyi: new Set<number>(),
  };

  for (const [, entries] of bySchool) {
    if (entries.length < minEmails) continue;

    const meta = schoolFromSender(
      String(entries[0]!.row.from ?? cache.get(String(entries[0]!.row.messageId ?? ''))?.from ?? ''),
    );
    if (!meta) continue;

    const needsYou: SchoolRoundupItem[] = [];
    const fyiItems: SchoolRoundupItem[] = [];
    const messageIds: string[] = [];

    for (const { row } of entries) {
      const item = toRoundupItem(row, cache);
      if (item.messageId) messageIds.push(item.messageId);
      if (isActionableSchoolRow(row)) needsYou.push(item);
      else fyiItems.push(item);
    }

    schoolRoundups.push({
      school: meta.school,
      child: meta.child,
      emailCount: entries.length,
      needsYou,
      fyi: fyiItems,
      messageIds,
    });

    for (const { list, index } of entries) {
      removeSets[list].add(index);
    }
  }

  if (schoolRoundups.length === 0) return triage;

  const filterList = (list: unknown[], removed: Set<number>) =>
    list.filter((_, i) => !removed.has(i));

  const rollupRows = schoolRoundups.map(roundup => {
    const needsYouLines = roundup.needsYou.map(
      item => item.action?.trim() || item.reason || item.subject,
    );
    const fyiLines = roundup.fyi.map(item => item.subject);
    const actionParts = [
      ...needsYouLines.map(line => `• ${line}`),
      ...(fyiLines.length > 0 ? [`FYI: ${fyiLines.slice(0, 4).join('; ')}${fyiLines.length > 4 ? '…' : ''}`] : []),
    ];
    const hasQueue = roundup.needsYou.some(item => item.queueActionId);
    return {
      kind: 'school_roundup',
      school: roundup.school,
      child: roundup.child,
      emailCount: roundup.emailCount,
      from: `${roundup.school} (${roundup.child})`,
      subject: `${roundup.school} — ${roundup.child} (${roundup.emailCount} school emails)`,
      urgency: roundup.needsYou.length > 0 ? 'HIGH' : 'NORMAL',
      reason: `${roundup.emailCount} emails from ${roundup.school} for ${roundup.child}`,
      action: actionParts.join('\n'),
      messageIds: roundup.messageIds,
      queueActionId: roundup.needsYou.find(item => item.queueActionId)?.queueActionId,
      ...(hasQueue ? {} : {}),
    };
  });

  return {
    ...triage,
    urgent: filterList(urgent, removeSets.urgent),
    actionRequired: [...filterList(actionRequired, removeSets.actionRequired), ...rollupRows],
    fyi: filterList(fyi, removeSets.fyi),
    schoolRoundups,
  };
}
