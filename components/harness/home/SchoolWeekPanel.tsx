'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SchoolFeed } from '@/types/knowledge-base';
import { dedupeSchoolCalendarEvents } from '@/lib/harness/school-calendar-classify';
import SchoolWeekCalendar from './SchoolWeekCalendar';
import SchoolTodayPanel from './SchoolTodayPanel';

interface NangoConnectionPublic {
  integrationId: string;
  email?: string;
}

interface Props {
  refreshKey?: number;
  className?: string;
}

export default function SchoolWeekPanel({ refreshKey = 0, className = '' }: Props) {
  const [feed, setFeed] = useState<SchoolFeed | null>(null);
  const [connections, setConnections] = useState<NangoConnectionPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [feedRes, connRes] = await Promise.all([
          fetch('/api/school-feed'),
          fetch('/api/nango/connections'),
        ]);
        if (feedRes.ok) {
          const data = await feedRes.json() as { feed: SchoolFeed | null };
          if (!cancelled) setFeed(data.feed);
        }
        if (connRes.ok) {
          const data = await connRes.json() as { connections?: NangoConnectionPublic[] };
          if (!cancelled) setConnections(data.connections ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const calendar = feed?.calendar;
  const events = dedupeSchoolCalendarEvents(calendar?.events ?? []);
  const hasEvents = events.length > 0;

  const missingCalendarChildren = useMemo(() => {
    const roundupChildren = new Set(
      (feed?.gmail?.roundups ?? []).map(r => r.child),
    );
    const calendarChildren = new Set(events.map(e => e.child));
    return [...roundupChildren].filter(child => !calendarChildren.has(child));
  }, [feed, events]);

  const gmailMissingCalendar = useMemo(() => {
    const calendarEmails = new Set(
      connections
        .filter(c => c.integrationId === 'google-calendar')
        .map(c => c.email?.trim().toLowerCase())
        .filter(Boolean),
    );
    return connections
      .filter(c => c.integrationId === 'google-mail' && c.email)
      .filter(c => !calendarEmails.has(c.email!.trim().toLowerCase()))
      .map(c => c.email!);
  }, [connections]);

  return (
    <section className={`shrink-0 px-4 py-3 border-b border-border bg-surface-muted/30 space-y-3 ${className}`}>
      {!loading && hasEvents && (
        <SchoolTodayPanel feed={feed} />
      )}

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle mb-2">
          This week
        </h3>
        {loading && (
          <p className="text-[11px] text-foreground-muted">Loading calendar…</p>
        )}
        {!loading && hasEvents && calendar && (
          <SchoolWeekCalendar calendar={{ ...calendar, events }} hideHeading />
        )}
        {!loading && !hasEvents && (
          <p className="text-[11px] text-foreground-muted leading-snug">
            No school events in the next 7 days. Sync from School updates when your calendar changes.
          </p>
        )}
      </div>

      {!loading && missingCalendarChildren.length > 0 && (
        <p className="text-[11px] text-foreground-muted leading-snug">
          No calendar events for {missingCalendarChildren.join(' or ')} yet.
          {gmailMissingCalendar.length > 0 ? (
            <>
              {' '}Connect Calendar in Settings for{' '}
              <span className="font-medium text-foreground">{gmailMissingCalendar.join(' or ')}</span>
              {' — that\'s usually where school calendars like Seb\'s live.'}
            </>
          ) : (
            ' Sync again after connecting the Google account that holds their school calendar.'
          )}
        </p>
      )}
    </section>
  );
}
