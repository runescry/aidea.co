import { gmailMessageUrlFromEmail } from '@/lib/gmail/message-url';
import { readGmailMessages } from '@/lib/nango/gmail';
import { fetchGmailAttachments } from '@/lib/nango/gmail-attachments';
import { extractTextFromBuffer } from '@/lib/documents/extract-text';
import { readAllKB, writeKB } from '@/lib/harness/knowledge-base';
import type { KnowledgeBase, SchoolFeed, SchoolFeedEmailRow } from '@/types/knowledge-base';
import { INBOX_LOOKBACK_DAYS } from './inbox-window';
import {
  buildSchoolGmailFromQuery,
  loadSchoolProfiles,
} from './school-config';
import {
  classifySchoolEmails,
  partitionSchoolRows,
  parseSchoolDeadline,
  type SchoolEmailRow,
} from './school-rules';
import { bundleSchoolTriage } from './school-roundup';
import type { CachedGmail } from './inbox-sanitize';
import type { SchoolRoundup } from './school-roundup';

export interface SchoolInboxSyncResult {
  ok: boolean;
  emailCount: number;
  actionRequired: number;
  fyi: number;
  roundups: number;
  query: string;
  error?: string;
}

function toFeedRow(row: SchoolEmailRow): SchoolFeedEmailRow {
  return {
    messageId: row.messageId,
    from: row.from,
    subject: row.subject,
    snippet: row.snippet,
    school: row.school,
    child: row.child,
    category: row.category,
    priority: row.priority,
    deadline: row.deadline,
    attachmentSummary: row.attachmentSummary,
    internetMessageId: row.internetMessageId,
    account: row.account,
    threadId: row.threadId,
    gmailUrl: gmailMessageUrlFromEmail({
      id: row.messageId,
      threadId: row.threadId,
      account: row.account,
      internetMessageId: row.internetMessageId,
      subject: row.subject,
      from: row.from,
    }),
  };
}

async function enrichActionRowsWithAttachments(rows: SchoolEmailRow[]): Promise<SchoolEmailRow[]> {
  const enriched: SchoolEmailRow[] = [];
  for (const row of rows) {
    if (!row.connectionId) {
      enriched.push(row);
      continue;
    }
    try {
      const { attachments } = await fetchGmailAttachments({
        messageId: row.messageId,
        connectionId: row.connectionId,
        maxAttachments: 2,
        extractText: extractTextFromBuffer,
      });
      if (attachments.length === 0) {
        enriched.push(row);
        continue;
      }
      const attachmentSummary = attachments
        .map(a => `[${a.filename}]\n${a.text}`)
        .join('\n\n')
        .slice(0, 2000);
      const deadline = row.deadline ?? parseSchoolDeadline(attachmentSummary);
      enriched.push({ ...row, attachmentSummary, deadline });
    } catch {
      enriched.push(row);
    }
  }
  return enriched;
}

function rowToTriageItem(row: SchoolEmailRow): Record<string, unknown> {
  return {
    from: row.from,
    subject: row.subject,
    snippet: row.snippet,
    messageId: row.messageId,
    threadId: row.threadId,
    account: row.account,
    urgency: row.priority === 'action_required' ? 'HIGH' : 'NORMAL',
    reason: row.snippet,
    action: row.category === 'permission'
      ? 'Sign and return permission form'
      : row.category === 'payment'
        ? 'Complete payment'
        : row.deadline
          ? `Due ${row.deadline}`
          : 'Review this email',
  };
}

function emailsToCache(emails: Array<{ id: string; from: string; subject: string; snippet: string; date?: string; threadId?: string; account?: string; connectionId?: string; bodyText?: string }>): Map<string, CachedGmail> {
  return new Map(
    emails.map(e => [e.id, {
      id: e.id,
      from: e.from,
      subject: e.subject,
      snippet: e.snippet,
      date: e.date,
      threadId: e.threadId,
      account: e.account,
      connectionId: e.connectionId,
      bodyText: e.bodyText,
    }]),
  );
}

function roundupToFeedRoundup(roundup: SchoolRoundup): SchoolFeed['gmail']['roundups'][number] {
  return {
    school: roundup.school,
    child: roundup.child,
    emailCount: roundup.emailCount,
    needsYou: roundup.needsYou.map(item => ({
      messageId: item.messageId ?? '',
      from: '',
      subject: item.subject,
      snippet: item.reason,
      school: roundup.school,
      child: roundup.child,
      category: 'general',
      priority: 'action_required' as const,
      gmailUrl: item.gmailUrl,
    })),
    fyi: roundup.fyi.map(item => ({
      messageId: item.messageId ?? '',
      from: '',
      subject: item.subject,
      snippet: item.reason,
      school: roundup.school,
      child: roundup.child,
      category: 'newsletter',
      priority: 'fyi' as const,
      gmailUrl: item.gmailUrl,
    })),
    messageIds: roundup.messageIds,
  };
}

export async function syncSchoolInbox(): Promise<SchoolInboxSyncResult> {
  const kb = await readAllKB();
  const profiles = loadSchoolProfiles(kb);
  const fromClause = buildSchoolGmailFromQuery(profiles);
  const query = fromClause
    ? `${fromClause} newer_than:${INBOX_LOOKBACK_DAYS}d`
    : `newer_than:${INBOX_LOOKBACK_DAYS}d`;

  try {
    const { emails, connections } = await readGmailMessages({
      query,
      maxResults: 30,
      includeBody: false,
    });

    if (emails.length === 0) {
      const existing = (kb as KnowledgeBase).family?.schoolFeed;
      const emptyFeed: SchoolFeed = {
        updatedAt: new Date().toISOString(),
        gmail: { roundups: [], actionRequired: [], fyi: [] },
        ...(existing?.calendar ? { calendar: existing.calendar } : {}),
        ...(existing?.sharepoint ? { sharepoint: existing.sharepoint } : {}),
      };
      await writeKB('family.schoolFeed', emptyFeed);
      return { ok: true, emailCount: 0, actionRequired: 0, fyi: 0, roundups: 0, query };
    }

    const cache = emailsToCache(emails);
    let classified = classifySchoolEmails([...cache.values()], profiles);
    const { actionRequired: actionRaw, fyi } = partitionSchoolRows(classified);
    const actionRequired = await enrichActionRowsWithAttachments(actionRaw);
    classified = [...actionRequired, ...fyi];

    const triageInput = {
      urgent: classified.filter(r => r.priority === 'action_required').map(rowToTriageItem),
      actionRequired: [] as unknown[],
      fyi: classified.filter(r => r.priority === 'fyi').map(rowToTriageItem),
    };

    const bundled = bundleSchoolTriage(triageInput, cache, 2, profiles);
    const roundups = (bundled.schoolRoundups ?? []) as SchoolRoundup[];

    const kbTyped = kb as KnowledgeBase;
    const existingSharepoint = kbTyped.family?.schoolFeed?.sharepoint;
    const existingCalendar = kbTyped.family?.schoolFeed?.calendar;

    const feed: SchoolFeed = {
      updatedAt: new Date().toISOString(),
      gmail: {
        roundups: roundups.map(roundupToFeedRoundup),
        actionRequired: actionRequired.map(toFeedRow),
        fyi: fyi.map(toFeedRow),
      },
      ...(existingCalendar ? { calendar: existingCalendar } : {}),
      ...(existingSharepoint ? { sharepoint: existingSharepoint } : {}),
    };

    await writeKB('family.schoolFeed', feed);

    return {
      ok: true,
      emailCount: emails.length,
      actionRequired: actionRequired.length,
      fyi: fyi.length,
      roundups: roundups.length,
      query,
      ...(connections.length === 0 ? { error: 'No Gmail connections' } : {}),
    };
  } catch (err) {
    return {
      ok: false,
      emailCount: 0,
      actionRequired: 0,
      fyi: 0,
      roundups: 0,
      query,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
