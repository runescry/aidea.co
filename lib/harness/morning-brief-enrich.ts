import { gmailMessageUrlFromEmail } from '@/lib/gmail/message-url';
import { readGmailMessagesByIds } from '@/lib/nango/gmail';
import { hasNangoConnections } from '@/lib/nango/connections';
import { looksLikeBadHeadline, nonEmpty } from './morning-brief-must-do';

export function applyGmailMetadataToMustDo(
  items: Record<string, unknown>[],
  emails: Array<{
    id: string;
    subject: string;
    from: string;
    snippet: string;
    threadId?: string;
    account?: string;
  }>,
): Record<string, unknown>[] {
  const byId = new Map(emails.map(email => [email.id, email]));
  return items.map(item => {
    const id = nonEmpty(item.messageId);
    const email = id ? byId.get(id) : undefined;
    if (!email) return item;
    return {
      ...item,
      subject: nonEmpty(item.subject, email.subject),
      from: nonEmpty(item.from, email.from),
      threadId: nonEmpty(item.threadId, email.threadId),
      account: nonEmpty(item.account, email.account),
      snippet: nonEmpty(item.snippet, email.snippet),
      gmailUrl: gmailMessageUrlFromEmail({
        id: email.id,
        threadId: email.threadId,
        account: email.account,
      }),
    };
  });
}

export async function enrichBriefMustDoFromGmail(
  brief: Record<string, unknown> | null | undefined,
): Promise<Record<string, unknown> | null | undefined> {
  if (!brief || !Array.isArray(brief.mustDo)) return brief;

  const items = brief.mustDo as Record<string, unknown>[];
  const ids = [
    ...new Set(
      items
        .filter(item => {
          const id = nonEmpty(item.messageId);
          if (!id) return false;
          const subject = nonEmpty(item.subject);
          const headline = nonEmpty(item.action);
          return !subject || looksLikeBadHeadline(headline);
        })
        .map(item => nonEmpty(item.messageId))
        .filter(Boolean),
    ),
  ];
  if (ids.length === 0) return brief;

  try {
    if (!(await hasNangoConnections())) return brief;
    const emails = await readGmailMessagesByIds({ messageIds: ids, includeBody: false });
    if (emails.length === 0) return brief;
    return { ...brief, mustDo: applyGmailMetadataToMustDo(items, emails) };
  } catch {
    return brief;
  }
}
