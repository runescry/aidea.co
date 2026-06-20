import type { QueuedAction } from './queue-types';

export interface CalendarEventPayload {
  title: string;
  start: string;
  durationMinutes: number;
  description?: string;
  attendees?: string[];
}

export function calendarPayloadFromAction(
  action: Pick<QueuedAction, 'payload' | 'summary'>,
): CalendarEventPayload {
  const payload = action.payload ?? {};
  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : action.summary.replace(/^Calendar:\s*/i, '').split(' at ')[0]?.trim() ?? 'Untitled event';
  const start = typeof payload.start === 'string' ? payload.start : '';
  const durationMinutes = typeof payload.durationMinutes === 'number'
    ? payload.durationMinutes
    : Number(payload.durationMinutes) || 60;
  const description = typeof payload.description === 'string' ? payload.description : undefined;
  const attendees = Array.isArray(payload.attendees)
    ? payload.attendees.filter((a): a is string => typeof a === 'string')
    : typeof payload.attendees === 'string'
      ? payload.attendees.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;
  return { title, start, durationMinutes, description, attendees };
}

export function formatCalendarStart(iso: string): string {
  if (!iso) return 'Time not set';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCalendarDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function describeCalendarEvent(action: Pick<QueuedAction, 'payload' | 'summary' | 'detail'>): string {
  const cal = calendarPayloadFromAction(action);
  const lines = [
    cal.title,
    cal.start ? formatCalendarStart(cal.start) : null,
    `${formatCalendarDuration(cal.durationMinutes)}`,
  ].filter(Boolean) as string[];
  if (cal.attendees?.length) lines.push(`With: ${cal.attendees.join(', ')}`);
  const desc = cal.description ?? action.detail;
  if (desc?.trim()) lines.push('', desc.trim());
  return lines.join('\n');
}
