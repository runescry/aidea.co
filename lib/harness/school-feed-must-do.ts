import type { SchoolFeed, SchoolFeedEmailRow, SchoolFeedRoundup } from '@/types/knowledge-base';
import type { SchoolRoundup } from './school-roundup';
import { roundupToMustDoItems } from './school-roundup';

const STALE_MS = 24 * 60 * 60 * 1000;

export function isSchoolFeedFresh(feed: SchoolFeed | null | undefined, now = Date.now()): boolean {
  if (!feed?.updatedAt) return false;
  const at = new Date(feed.updatedAt).getTime();
  return !Number.isNaN(at) && now - at <= STALE_MS;
}

function feedRowToMustDo(row: SchoolFeedEmailRow, priority: number) {
  return {
    priority,
    action: row.category === 'permission'
      ? `Sign: ${row.subject}`
      : row.category === 'payment'
        ? `Pay: ${row.subject}`
        : row.subject,
    context: `${row.school} · ${row.child}`,
    detail: row.deadline ? `Due ${row.deadline}` : row.snippet,
    source: 'school' as const,
    urgency: row.priority === 'action_required' ? 'HIGH' : 'NORMAL',
    messageId: row.messageId,
    gmailUrl: row.gmailUrl,
  };
}

function feedRoundupToSchoolRoundup(roundup: SchoolFeedRoundup): SchoolRoundup {
  return {
    school: roundup.school,
    child: roundup.child,
    emailCount: roundup.emailCount,
    needsYou: roundup.needsYou.map(r => ({
      subject: r.subject,
      reason: r.snippet,
      action: r.category === 'permission' ? 'Sign and return' : r.subject,
      messageId: r.messageId,
      gmailUrl: r.gmailUrl,
    })),
    fyi: roundup.fyi.map(r => ({
      subject: r.subject,
      reason: r.snippet,
      messageId: r.messageId,
      gmailUrl: r.gmailUrl,
    })),
    messageIds: roundup.messageIds,
  };
}

/** Build mustDo rows from family.schoolFeed — preferred over inbox_triage school roundups. */
export function schoolFeedToMustDoItems(
  feed: SchoolFeed,
  startPriority = 1,
): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [];
  let priority = startPriority;

  for (const roundup of feed.gmail.roundups ?? []) {
    const expanded = roundupToMustDoItems(feedRoundupToSchoolRoundup(roundup), priority);
    for (const row of expanded) {
      items.push(row as Record<string, unknown>);
      priority = Math.max(priority, row.priority) + 1;
    }
  }

  for (const row of feed.gmail.actionRequired ?? []) {
    items.push(feedRowToMustDo(row, priority++));
  }

  for (const row of feed.gmail.fyi ?? []) {
    items.push(feedRowToMustDo(row, priority++));
  }

  return items;
}
