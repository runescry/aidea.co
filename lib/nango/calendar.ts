import { getNango } from './client';
import { resolveCalendarConnections, type NangoConnectionPublic } from './connections';
import {
  addCalendarDays,
  calendarDayRange,
  eventDateYmd,
  formatEventTime,
  isSameCalendarDay,
  toDateYmd,
} from '@/lib/calendar/dates';
import {
  calendarDayRangeInTimeZone,
  eventDateYmdInTimeZone,
} from '@/lib/calendar/user-time';

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  date: string;
  time: string;
  attendees: string[];
  location: string;
  description: string;
  connectionId: string;
  account?: string;
  htmlLink?: string;
}

async function readCalendarForConnection(
  conn: NangoConnectionPublic,
  options: { date: string; spanDays: number; maxResults: number; timeZone?: string },
): Promise<CalendarEvent[]> {
  const nango = getNango();
  const { timeMin, timeMax } = options.timeZone
    ? calendarDayRangeInTimeZone(options.date, options.spanDays, options.timeZone)
    : calendarDayRange(options.date, options.spanDays);

  const res = await nango.get<{
    items?: Array<{
      summary?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      attendees?: Array<{ email: string; displayName?: string }>;
      location?: string;
      description?: string;
    }>;
  }>({
    providerConfigKey: conn.integrationId,
    connectionId: conn.connectionId,
    endpoint: '/calendar/v3/calendars/primary/events',
    params: {
      timeMin,
      timeMax,
      maxResults: options.maxResults,
      singleEvents: 'true',
      orderBy: 'startTime',
    },
  });

  return (res.data.items ?? []).map(e => {
    const start = e.start?.dateTime ?? e.start?.date ?? '';
    const eventDate = options.timeZone
      ? eventDateYmdInTimeZone(start, options.timeZone)
      : eventDateYmd(start);
    return {
      title: e.summary ?? '(no title)',
      start,
      end: e.end?.dateTime ?? e.end?.date ?? '',
      date: eventDate,
      time: formatEventTime(start),
      attendees: (e.attendees ?? []).map(a => a.displayName ?? a.email),
      location: e.location ?? '',
      description: (e.description ?? '').slice(0, 200),
      connectionId: conn.connectionId,
      account: conn.email,
      htmlLink: e.htmlLink,
    };
  });
}

export async function readCalendarEvents(options: {
  date?: string;
  daysAhead?: number;
  maxResults?: number;
  connectionId?: string;
  timeZone?: string;
}): Promise<{
  events: CalendarEvent[];
  todayEvents: CalendarEvent[];
  tomorrowEvents: CalendarEvent[];
  daysAhead: number;
  date: string;
  tomorrowDate: string;
  connections: string[];
  readErrors?: string[];
}> {
  const anchorDate = options.date?.slice(0, 10) ?? toDateYmd();
  const daysAhead = Math.max(1, options.daysAhead ?? 1);
  const maxResults = options.maxResults ?? 20;
  const { connectionId, timeZone } = options;
  const connections = await resolveCalendarConnections(connectionId);
  const tomorrowDate = addCalendarDays(anchorDate, 1);
  const readErrors: string[] = [];

  const batches = await Promise.all(
    connections.map(async conn => {
      try {
        return await readCalendarForConnection(conn, {
          date: anchorDate,
          spanDays: daysAhead,
          maxResults,
          timeZone,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        readErrors.push(`${conn.email ?? conn.connectionId}: ${message}`);
        return [];
      }
    }),
  );

  const events = batches.flat().sort((a, b) => a.start.localeCompare(b.start));
  const todayEvents = events.filter(e => isSameCalendarDay(e.start, anchorDate));
  const tomorrowEvents = events.filter(e => isSameCalendarDay(e.start, tomorrowDate));

  return {
    events,
    todayEvents,
    tomorrowEvents,
    daysAhead,
    date: anchorDate,
    tomorrowDate,
    connections: connections.map(c => c.connectionId),
    ...(readErrors.length > 0 ? { readErrors } : {}),
  };
}

export async function createCalendarEvent(input: {
  title: string;
  start: string;
  durationMinutes: number;
  description?: string;
  attendees?: string[];
  connectionId?: string;
}): Promise<{ eventId: string; title: string; start: string; connectionId: string }> {
  const [conn] = await resolveCalendarConnections(input.connectionId);
  const nango = getNango();
  const startDate = new Date(input.start);
  const endDate = new Date(startDate.getTime() + input.durationMinutes * 60_000);

  const res = await nango.post<{ id: string }>({
    providerConfigKey: conn.integrationId,
    connectionId: conn.connectionId,
    endpoint: '/calendar/v3/calendars/primary/events',
    data: {
      summary: input.title,
      description: input.description ?? '',
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
      attendees: (input.attendees ?? []).map(email => ({ email })),
    },
  });

  return {
    eventId: res.data.id,
    title: input.title,
    start: input.start,
    connectionId: conn.connectionId,
  };
}
