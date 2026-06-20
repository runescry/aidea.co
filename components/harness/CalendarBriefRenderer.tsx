'use client';

interface ScheduleItem {
  time?: string;
  title?: string;
  location?: string;
  attendees?: string[];
  notes?: string;
  date?: string;
}

interface CalendarBriefData {
  todaySchedule?: ScheduleItem[];
  tomorrowPreview?: ScheduleItem[];
  logisticsFlags?: string[];
  firstMeeting?: ScheduleItem | null;
}

function ScheduleRow({ item }: { item: ScheduleItem }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs font-mono text-foreground-subtle w-14 shrink-0 pt-0.5">{item.time ?? '—'}</span>
      <div className="min-w-0">
        <div className="text-sm text-foreground font-medium">{item.title}</div>
        {item.location && <div className="text-xs text-foreground-muted">{item.location}</div>}
        {item.attendees && item.attendees.length > 0 && (
          <div className="text-xs text-foreground-subtle">{item.attendees.slice(0, 4).join(', ')}</div>
        )}
        {item.notes && <div className="text-xs text-foreground-muted mt-0.5">{item.notes}</div>}
      </div>
    </div>
  );
}

export default function CalendarBriefRenderer({ data }: { data: CalendarBriefData }) {
  const today = data.todaySchedule ?? [];
  const tomorrow = data.tomorrowPreview ?? [];
  const flags = data.logisticsFlags ?? [];

  return (
    <div className="space-y-5 max-w-2xl font-sans">
      {today.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle">Today</h3>
          {today.map((item, i) => <ScheduleRow key={`${item.title}-${i}`} item={item} />)}
        </div>
      ) : (
        <p className="text-sm text-foreground-muted">No events on today&apos;s calendar.</p>
      )}

      {flags.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle">Logistics</h3>
          {flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-warning shrink-0">!</span>
              <span className="text-foreground-muted">{flag}</span>
            </div>
          ))}
        </div>
      )}

      {tomorrow.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle">Tomorrow</h3>
          {tomorrow.map((item, i) => <ScheduleRow key={`${item.title}-${i}`} item={item} />)}
        </div>
      )}
    </div>
  );
}
