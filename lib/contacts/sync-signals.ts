import type { GmailMessage } from '@/lib/nango/gmail';
import type { CalendarEvent } from '@/lib/nango/calendar';
import { recordContactInteraction } from './interaction-graph-persist';
import { parseRecipient } from './record-from-action';

export async function syncContactSignalsFromEmails(emails: GmailMessage[]): Promise<number> {
  let count = 0;
  for (const email of emails) {
    const { name, email: addr } = parseRecipient(email.from);
    if (!name) continue;
    await recordContactInteraction({
      name,
      email: addr,
      channel: 'email',
      summary: email.subject ? `Thread: ${email.subject}` : 'Email thread',
    });
    count++;
  }
  return count;
}

export async function syncContactSignalsFromCalendar(events: CalendarEvent[]): Promise<number> {
  let count = 0;
  for (const event of events) {
    const summary = `Event: ${event.title}`;
    for (const attendee of event.attendees ?? []) {
      const { name, email } = parseRecipient(attendee);
      if (!name) continue;
      await recordContactInteraction({
        name,
        email,
        channel: 'calendar',
        summary,
      });
      count++;
    }
  }
  return count;
}

export async function recordRelationshipMonitorSignals(
  cooling: Array<{ name?: string; email?: string; weeksSince?: number }>,
): Promise<number> {
  let count = 0;
  for (const contact of cooling) {
    if (!contact.name?.trim()) continue;
    await recordContactInteraction({
      name: contact.name.trim(),
      email: contact.email,
      channel: 'relationship-monitor',
      summary: contact.weeksSince != null
        ? `Cooling — ${contact.weeksSince} weeks since touch`
        : 'Cooling relationship flagged',
    });
    count++;
  }
  return count;
}
