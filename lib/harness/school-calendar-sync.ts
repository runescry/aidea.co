import { readCalendarEvents } from '@/lib/nango/calendar';
import { readAllKB, writeKB } from '@/lib/harness/knowledge-base';
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

function preserveExistingFeedSections(
  kb: KnowledgeBase,
  calendar: NonNullable<SchoolFeed['calendar']>,
): SchoolFeed {
  const existing = kb.family?.schoolFeed;
  return {
    updatedAt: new Date().toISOString(),
    gmail: existing?.gmail ?? { roundups: [], actionRequired: [], fyi: [] },
    calendar,
    ...(existing?.sharepoint ? { sharepoint: existing.sharepoint } : {}),
  };
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

    await writeKB('family.schoolFeed', preserveExistingFeedSections(kb, calendar));

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
