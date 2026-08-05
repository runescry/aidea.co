'use client';

import type { SchoolFeed } from '@/types/knowledge-base';
import { dedupeSchoolCalendarEvents } from '@/lib/harness/school-calendar-classify';
import { buildSchoolPrepItems, buildSchoolTodayItems } from '@/lib/harness/school-today-digest';

function todayYmdLocal(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function SchoolTodayPanel({
  feed,
  showUpcoming = true,
}: {
  feed: SchoolFeed | null;
  showUpcoming?: boolean;
}) {
  const events = dedupeSchoolCalendarEvents(feed?.calendar?.events ?? []);
  const todayYmd = todayYmdLocal();
  const todayItems = buildSchoolTodayItems(events, todayYmd);
  const prepItems = showUpcoming ? buildSchoolPrepItems(events, todayYmd) : todayItems;

  if (prepItems.length === 0) return null;

  const upcomingOnly = prepItems.filter(item => {
    const key = `${item.child}:${item.calendarUrl ?? item.line}`;
    return !todayItems.some(t => `${t.child}:${t.calendarUrl ?? t.line}` === key);
  });

  return (
    <div className="rounded-lg border border-accent/20 bg-accent/[0.06] px-3 py-2.5 space-y-2">
      {todayItems.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Today</h4>
          <ul className="space-y-1">
            {todayItems.map(item => (
              <li key={`today:${item.line}`} className="text-[13px] leading-snug text-foreground">
                {item.calendarUrl ? (
                  <a href={item.calendarUrl} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">
                    {item.line}
                  </a>
                ) : (
                  item.line
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showUpcoming && upcomingOnly.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
            {todayItems.length > 0 ? 'Coming up' : 'Prep this week'}
          </h4>
          <ul className="space-y-1">
            {upcomingOnly.map(item => (
              <li key={`upcoming:${item.line}`} className="text-[13px] leading-snug text-foreground">
                {item.calendarUrl ? (
                  <a href={item.calendarUrl} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">
                    {item.line}
                  </a>
                ) : (
                  item.line
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
