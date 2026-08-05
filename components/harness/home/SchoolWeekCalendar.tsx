'use client';

import type { SchoolCalendarEventRow, SchoolFeedCalendar } from '@/types/knowledge-base';
import { dedupeSchoolCalendarEvents, schoolCalendarEventLabel } from '@/lib/harness/school-calendar-classify';
import { schoolEventToPrepLine } from '@/lib/harness/school-today-digest';

const TYPE_ICON: Record<SchoolCalendarEventRow['eventType'], string> = {
  sport: '🏃',
  library: '📚',
  excursion: '🚌',
  other: '📅',
};

function formatDayLabel(dateYmd: string): string {
  const d = new Date(`${dateYmd}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateYmd;
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

function groupByChild(events: SchoolCalendarEventRow[]): Map<string, SchoolCalendarEventRow[]> {
  const map = new Map<string, SchoolCalendarEventRow[]>();
  for (const event of events) {
    const key = `${event.child} · ${event.school}`;
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return map;
}

export default function SchoolWeekCalendar({
  calendar,
  hideHeading = false,
}: {
  calendar: SchoolFeedCalendar;
  hideHeading?: boolean;
}) {
  const events = dedupeSchoolCalendarEvents(calendar.events);
  if (events.length === 0) return null;

  const byChild = groupByChild(events);

  return (
    <div className="space-y-2.5">
      {!hideHeading && (
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-medium text-foreground-muted">This week</h4>
          <span className="text-[10px] text-foreground-subtle shrink-0">
            {formatDayLabel(calendar.weekStart)} – {formatDayLabel(calendar.weekEnd)}
          </span>
        </div>
      )}
      {hideHeading && (
        <p className="text-[10px] text-foreground-subtle">
          {formatDayLabel(calendar.weekStart)} – {formatDayLabel(calendar.weekEnd)}
        </p>
      )}
      {Array.from(byChild.entries()).map(([label, events]) => (
        <div key={label} className="space-y-1">
          <div className="text-[11px] font-medium text-foreground">{label}</div>
          <ul className="space-y-1">
            {events.map((event, index) => {
              const labelText = schoolCalendarEventLabel(event.eventType);
              const content = (
                <>
                  <span className="shrink-0" aria-hidden>{TYPE_ICON[event.eventType]}</span>
                  <span className="text-foreground-subtle shrink-0">{formatDayLabel(event.date)}</span>
                  <span className="text-foreground-muted shrink-0">{event.time !== 'All day' ? event.time : labelText}</span>
                  <span className="truncate">{schoolEventToPrepLine(event)}</span>
                </>
              );
              return (
                <li key={`${label}:${index}`} className="text-xs">
                  {event.calendarUrl ? (
                    <a
                      href={event.calendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 min-w-0 text-accent hover:underline"
                    >
                      {content}
                    </a>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0 text-foreground">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
