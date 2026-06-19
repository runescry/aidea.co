import { getNango, calendarIntegrationId } from './client';
import { resolveCalendarConnections, type NangoConnectionPublic } from './connections';

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  attendees: string[];
  location: string;
  description: string;
  connectionId: string;
  account?: string;
}

async function readCalendarForConnection(
  conn: NangoConnectionPublic,
  options: { date?: string; daysAhead: number; maxResults: number },
): Promise<CalendarEvent[]> {
  const nango = getNango();
  const timeMin = options.date ? new Date(options.date).toISOString() : new Date().toISOString();
  const timeMax = new Date(new Date(timeMin).getTime() + options.daysAhead * 86_400_000).toISOString();

  const res = await nango.get<{
    items?: Array<{
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      attendees?: Array<{ email: string; displayName?: string }>;
      location?: string;
      description?: string;
    }>;
  }>({
    providerConfigKey: calendarIntegrationId(),
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

  return (res.data.items ?? []).map(e => ({
    title: e.summary ?? '(no title)',
    start: e.start?.dateTime ?? e.start?.date ?? '',
    end: e.end?.dateTime ?? e.end?.date ?? '',
    attendees: (e.attendees ?? []).map(a => a.displayName ?? a.email),
    location: e.location ?? '',
    description: (e.description ?? '').slice(0, 200),
    connectionId: conn.connectionId,
    account: conn.email,
  }));
}

export async function readCalendarEvents(options: {
  date?: string;
  daysAhead?: number;
  maxResults?: number;
  connectionId?: string;
}): Promise<{ events: CalendarEvent[]; daysAhead: number; date: string; connections: string[] }> {
  const { date, daysAhead = 1, maxResults = 20, connectionId } = options;
  const connections = await resolveCalendarConnections(connectionId);

  const batches = await Promise.all(
    connections.map(async conn => {
      try {
        return await readCalendarForConnection(conn, { date, daysAhead, maxResults });
      } catch {
        return [];
      }
    }),
  );

  const events = batches.flat().sort((a, b) => a.start.localeCompare(b.start));
  const timeMin = date ? new Date(date).toISOString() : new Date().toISOString();

  return {
    events,
    daysAhead,
    date: timeMin,
    connections: connections.map(c => c.connectionId),
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
    providerConfigKey: calendarIntegrationId(),
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
