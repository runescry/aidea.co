import { gmailMessageUrl } from '@/lib/gmail/message-url';
import { schoolFromSender } from './school-roundup';

export function nonEmpty(...parts: unknown[]): string {
  for (const part of parts) {
    const value = String(part ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function decodeBriefText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function snippetHeadline(text: string, max = 100): string {
  const clean = decodeBriefText(text).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentence = clean.split(/[.!?\n]/)[0]?.trim() ?? clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

const GENERIC_ACTION = /^(review this email|read email|check email)$/i;
const BODY_GREETING = /^(hi|hey|dear|hello)\s+/i;

export function looksLikeBodyOpen(text: string): boolean {
  return BODY_GREETING.test(decodeBriefText(text).trim());
}

/** Pull a title from school-app / notification snippets when subject is missing. */
export function inferHeadlineFromSnippet(snippet: string): string {
  const clean = decodeBriefText(snippet).replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const posted = clean.match(/\bposted\s+(.+?)(?:\s+Jun\s+\d|\s+\d{1,2}\s+\w+\s+\d{4}|$)/i);
  if (posted?.[1]) return snippetHeadline(posted[1], 120);

  const withoutGreeting = clean.replace(/^(hi|hey|dear|hello)\s+[^,!.?]+[,.!?]\s*/i, '');
  if (withoutGreeting !== clean && withoutGreeting.length >= 12) {
    return snippetHeadline(withoutGreeting);
  }

  if (!looksLikeBodyOpen(clean)) return snippetHeadline(clean);
  return '';
}

export function mustDoHeadline(item: Record<string, unknown>): string {
  const subject = nonEmpty(item.subject);
  const snippet = nonEmpty(item.snippet, item.detail);
  const rawStep = nonEmpty(item.action, item.nextStep);
  const step = GENERIC_ACTION.test(rawStep) ? '' : rawStep;

  if (subject && (!rawStep || looksLikeBodyOpen(rawStep) || rawStep === snippet)) return subject;
  if (step && !looksLikeBodyOpen(step)) return step;
  if (subject) return subject;
  const inferred = inferHeadlineFromSnippet(snippet);
  if (inferred) return inferred;
  return 'Review email';
}

function senderLabel(context: string): string {
  const clean = decodeBriefText(context).trim();
  if (!clean) return '';
  const name = clean.match(/^([^<]+)</)?.[1]?.trim();
  if (name) return `Email from ${name}`;
  if (clean.includes('@')) return `Email from ${clean}`;
  return clean.length <= 48 ? clean : `${clean.slice(0, 47)}…`;
}

export function normalizeMustDoItem(item: Record<string, unknown>): Record<string, unknown> {
  const snippet = decodeBriefText(nonEmpty(item.snippet, item.detail));
  const subject = decodeBriefText(nonEmpty(item.subject));
  const action = mustDoHeadline({ ...item, subject, snippet });
  const fromField = decodeBriefText(nonEmpty(item.from));
  const existingContext = decodeBriefText(nonEmpty(item.context));
  const school = schoolFromSender(`${fromField} ${existingContext}`);
  const context = nonEmpty(
    existingContext,
    school ? `${school.school} · ${school.child}` : '',
    senderLabel(fromField),
    fromField,
  );
  const detailRaw = snippet;
  const detail = detailRaw && detailRaw !== action ? detailRaw : undefined;

  const messageId = nonEmpty(item.messageId);
  const threadId = nonEmpty(item.threadId);
  const account = nonEmpty(item.account);
  const gmailUrl = nonEmpty(
    item.gmailUrl,
    (messageId || threadId)
      ? gmailMessageUrl(messageId || threadId, { threadId: threadId || undefined, account: account || undefined })
      : '',
  );

  return {
    ...item,
    subject: subject || undefined,
    action,
    context,
    detail,
    gmailUrl: gmailUrl || undefined,
  };
}

const VAGUE_SUMMARY = /\b(one|several|\d+)\s+(school|email)/i;

/** Drop unlinked agent summaries, dedupe by messageId, fix empty actions. */
export function finalizeMustDoList(items: Record<string, unknown>[]): Record<string, unknown>[] {
  const normalized = items
    .map(normalizeMustDoItem)
    .filter(item => nonEmpty(item.action));

  const linked = normalized.filter(
    item => nonEmpty(item.messageId) || nonEmpty(item.gmailUrl) || item.source === 'school',
  );
  const candidates = linked.length > 0 ? linked : normalized;

  const seen = new Set<string>();
  const deduped = candidates.filter(item => {
    const id = nonEmpty(item.messageId);
    if (!id) {
      if (linked.length > 0 && VAGUE_SUMMARY.test(String(item.action))) return false;
      return true;
    }
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return deduped.slice(0, 8).map((item, i) => ({ ...item, priority: i + 1 }));
}

export function normalizeMorningBrief(brief: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(brief.mustDo)) return brief;
  return {
    ...brief,
    mustDo: finalizeMustDoList(brief.mustDo as Record<string, unknown>[]),
  };
}
