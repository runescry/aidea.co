import { readCalendarEvents } from '@/lib/nango/calendar';
import { readAllKB, writeManyKB } from '@/lib/harness/knowledge-base';
import { readProfile } from '@/lib/storage';
import { loadSchoolProfiles } from '@/lib/harness/school-config';
import { addCalendarDays } from '@/lib/calendar/dates';
import { resolveUserTimezone, userDateYmd } from '@/lib/calendar/user-time';
import type { KnowledgeBase, SchoolFeed } from '@/types/knowledge-base';
import { mapSchoolCalendarEvents } from './school-calendar-classify';

export const SCHOOL_CALENDAR_LOOKAHEAD_DAYS = 7;

export interface SchoolCalendarSyncResult {
  ok: boolean;
  eventCount: number;
  weekStart: string;
  weekEnd: string;
  error?: string;
}

function formatEventTimeLocal(start: string, timeZone: string): string {
  if (!start || start.length <= 10) return 'All day';
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start.slice(11, 16);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export async function syncSchoolCalendar(): Promise<SchoolCalendarSyncResult> {
  const kb = await readAllKB() as KnowledgeBase;
  const profiles = loadSchoolProfiles(kb);
  const timeZone = resolveUserTimezone(kb);
  const weekStart = userDateYmd(new Date(), timeZone);
  const weekEnd = addCalendarDays(weekStart, SCHOOL_CALENDAR_LOOKAHEAD_DAYS - 1);

  try {
    const { events, connections, readErrors } = await readCalendarEvents({
      date: weekStart,
      daysAhead: SCHOOL_CALENDAR_LOOKAHEAD_DAYS,
      maxResults: 50,
      timeZone,
    });

    const mapped = mapSchoolCalendarEvents(
      events.map(e => ({
        title: e.title,
        date: e.date,
        time: formatEventTimeLocal(e.start, timeZone),
        location: e.location,
        calendarUrl: e.htmlLink,
      })),
      profiles,
    );

    const calendar: NonNullable<SchoolFeed['calendar']> = {
      updatedAt: new Date().toISOString(),
      weekStart,
      weekEnd,
      events: mapped,
    };

    // Scoped write — only the calendar section, never the whole feed. school-sync (0 * * * *)
    // and school-inbox (*/15) collide at the top of every hour; a whole-feed write here would
    // clobber whatever gmail/sharepoint data a sibling job wrote concurrently.
    const updates: Record<string, unknown> = {
      'family.schoolFeed.calendar': calendar,
      'family.schoolFeed.updatedAt': new Date().toISOString(),
    };

    // Uncached read — readAllKB() memoizes for up to a minute. This job doesn't own gmail, but
    // if it's the first sync to ever run, there's no feed yet and Home's `feed?.gmail.roundups`
    // would throw. Only seed it when still missing.
    const fresh = await readProfile() as KnowledgeBase;
    if (!fresh.family?.schoolFeed?.gmail) {
      updates['family.schoolFeed.gmail'] = { roundups: [], actionRequired: [], fyi: [] };
    }

    await writeManyKB(updates);

    const calendarReadError = readErrors?.length
      ? readErrors[0]
      : undefined;

    return {
      ok: true,
      eventCount: mapped.length,
      weekStart,
      weekEnd,
      ...(calendarReadError ? { error: calendarReadError } : {}),
    };
  } catch (err) {
    return {
      ok: false,
      eventCount: 0,
      weekStart,
      weekEnd,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
