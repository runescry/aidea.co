import type { CachedGmail } from './inbox-sanitize';
import { loadSchoolProfiles, schoolFromSender } from './school-config';
import type { SchoolProfile } from './school-config';

export type SchoolCategory =
  | 'permission'
  | 'excursion'
  | 'payment'
  | 'newsletter'
  | 'timetable'
  | 'general';

export type SchoolPriority = 'action_required' | 'fyi';

export interface SchoolEmailRow {
  messageId: string;
  from: string;
  subject: string;
  snippet: string;
  school: string;
  child: string;
  category: SchoolCategory;
  priority: SchoolPriority;
  deadline?: string;
  gmailUrl?: string;
  threadId?: string;
  account?: string;
  connectionId?: string;
  attachmentSummary?: string;
}

const PERMISSION = /\b(permission|consent|sign|return form|reply required|action required)\b/i;
const EXCURSION = /\b(excursion|camp|incursion|outing|zoo|museum)\b/i;
const PAYMENT = /\b(payment|pay \$|invoice|fee due|contribution)\b/i;
const NEWSLETTER = /\b(newsletter|weekly news|school news|bulletin)\b/i;
const TIMETABLE = /\b(timetable|schedule|class times|period)\b/i;
const ACTION_HINT = /\b(reply|confirm|return|submit|sign|pay|rsvp|deadline|asap|urgent|due by|by \w+day)\b/i;

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function classifyCategory(text: string): SchoolCategory {
  if (PERMISSION.test(text)) return 'permission';
  if (EXCURSION.test(text)) return 'excursion';
  if (PAYMENT.test(text)) return 'payment';
  if (TIMETABLE.test(text)) return 'timetable';
  if (NEWSLETTER.test(text)) return 'newsletter';
  return 'general';
}

function classifyPriority(category: SchoolCategory, text: string): SchoolPriority {
  if (category === 'permission' || category === 'payment') return 'action_required';
  if (category === 'excursion' && ACTION_HINT.test(text)) return 'action_required';
  if (ACTION_HINT.test(text)) return 'action_required';
  if (category === 'newsletter' || category === 'timetable') return 'fyi';
  return 'fyi';
}

/** Parse simple deadline phrases from email text. Returns ISO date (YYYY-MM-DD) when found. */
export function parseSchoolDeadline(text: string, now = new Date()): string | undefined {
  const lower = text.toLowerCase();

  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})\b/);
  if (slash) {
    const day = slash[1]!.padStart(2, '0');
    const month = slash[2]!.padStart(2, '0');
    return `${slash[3]}-${month}-${day}`;
  }

  const dayMonth = text.match(/\b(\d{1,2})\s+([A-Za-z]+)(?:\s+(20\d{2}))?\b/);
  if (dayMonth) {
    const monthKey = dayMonth[2]!.toLowerCase();
    const month = MONTHS[monthKey];
    if (month != null) {
      const year = dayMonth[3] ? Number(dayMonth[3]) : now.getFullYear();
      const d = new Date(Date.UTC(year, month, Number(dayMonth[1])));
      return d.toISOString().slice(0, 10);
    }
  }

  if (/\btoday\b/i.test(lower)) return now.toISOString().slice(0, 10);
  if (/\btomorrow\b/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  return undefined;
}

function rowFromEmail(email: CachedGmail, profile: { school: string; child: string }): SchoolEmailRow {
  const text = `${email.subject} ${email.snippet} ${email.bodyText ?? ''}`;
  const category = classifyCategory(text);
  const priority = classifyPriority(category, text);
  const deadline = parseSchoolDeadline(text);

  return {
    messageId: email.id,
    from: email.from,
    subject: email.subject,
    snippet: email.snippet,
    school: profile.school,
    child: profile.child,
    category,
    priority,
    deadline,
    threadId: email.threadId,
    account: email.account,
    connectionId: email.connectionId,
  };
}

/** Deterministic school email classification — no LLM. */
export function classifySchoolEmails(
  emails: CachedGmail[],
  profiles: SchoolProfile[] = loadSchoolProfiles(),
): SchoolEmailRow[] {
  const rows: SchoolEmailRow[] = [];

  for (const email of emails) {
    const match = schoolFromSender(email.from, profiles);
    if (!match) continue;
    rows.push(rowFromEmail(email, match));
  }

  const priorityOrder: Record<SchoolPriority, number> = {
    action_required: 0,
    fyi: 1,
  };

  return rows.sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return b.subject.localeCompare(a.subject);
  });
}

export function partitionSchoolRows(rows: SchoolEmailRow[]): {
  actionRequired: SchoolEmailRow[];
  fyi: SchoolEmailRow[];
} {
  return {
    actionRequired: rows.filter(r => r.priority === 'action_required'),
    fyi: rows.filter(r => r.priority === 'fyi'),
  };
}
