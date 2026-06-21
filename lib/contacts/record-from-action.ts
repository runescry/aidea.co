import { recordContactInteraction } from './interaction-graph-persist';

function parseRecipient(raw: string): { name: string; email?: string } {
  const trimmed = raw.trim();
  const angle = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    const name = angle[1].replace(/^"|"$/g, '').trim();
    return { name: name || angle[2], email: angle[2].trim() };
  }
  if (trimmed.includes('@')) {
    const local = trimmed.split('@')[0] ?? trimmed;
    return { name: local, email: trimmed };
  }
  return { name: trimmed };
}

function splitRecipients(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

export async function recordEmailSent(input: {
  to: string;
  cc?: string;
  subject?: string;
}): Promise<void> {
  const recipients = [...splitRecipients(input.to), ...splitRecipients(input.cc)];
  const summary = input.subject ? `Sent: ${input.subject}` : 'Email sent';
  for (const recipient of recipients) {
    const { name, email } = parseRecipient(recipient);
    if (!name) continue;
    await recordContactInteraction({ name, email, channel: 'email', summary });
  }
}

export async function recordCalendarCreated(input: {
  title: string;
  attendees?: string[];
}): Promise<void> {
  const summary = `Calendar: ${input.title}`;
  for (const attendee of input.attendees ?? []) {
    const { name, email } = parseRecipient(attendee);
    if (!name) continue;
    await recordContactInteraction({ name, email, channel: 'calendar', summary });
  }
}
