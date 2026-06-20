'use client';

interface EmailItem {
  from?: string;
  subject?: string;
  snippet?: string;
  urgency?: string;
  reason?: string;
  action?: string;
  messageId?: string;
  queueActionId?: string;
  attributionWarning?: string;
}

interface InboxTriageData {
  urgent?: EmailItem[];
  actionRequired?: EmailItem[];
  fyi?: EmailItem[];
  draftsQueued?: number;
  profileUpdatesQueued?: number;
  profileUpdatesApplied?: number;
}

const URGENCY_STYLE: Record<string, string> = {
  HIGH: 'bg-danger/10 text-danger',
  NORMAL: 'bg-warning/10 text-warning',
  LOW: 'bg-surface-subtle text-foreground-subtle',
};

function EmailCard({ item, showAction }: { item: EmailItem; showAction?: boolean }) {
  const urgency = (item.urgency ?? 'NORMAL').toUpperCase();
  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{item.subject ?? 'No subject'}</div>
          {item.from && <div className="text-xs text-foreground-muted mt-0.5">{item.from}</div>}
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${URGENCY_STYLE[urgency] ?? URGENCY_STYLE.NORMAL}`}>
          {urgency}
        </span>
      </div>
      {item.snippet && (
        <p className="text-xs text-foreground-muted border-l-2 border-border pl-2">{item.snippet}</p>
      )}
      {item.reason && item.reason !== item.snippet && (
        <p className="text-xs text-foreground-muted">{item.reason}</p>
      )}
      {item.attributionWarning && (
        <p className="text-[11px] text-warning">{item.attributionWarning}</p>
      )}
      {showAction && item.action && (
        <div className="text-xs text-foreground border-l-2 border-accent pl-2">
          {item.action}
        </div>
      )}
      {item.queueActionId && (
        <div className="text-[11px] text-accent font-medium">
          Draft queued — review on Home → Inbox → Awaiting approval
        </div>
      )}
    </div>
  );
}

function Section({ title, items, showAction }: { title: string; items: EmailItem[]; showAction?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle">{title}</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <EmailCard key={`${item.subject}-${i}`} item={item} showAction={showAction} />
        ))}
      </div>
    </div>
  );
}

export default function InboxTriageRenderer({ data }: { data: InboxTriageData }) {
  const stats = [
    data.draftsQueued ? `${data.draftsQueued} draft${data.draftsQueued === 1 ? '' : 's'} queued` : null,
    data.profileUpdatesApplied ? `${data.profileUpdatesApplied} profile update${data.profileUpdatesApplied === 1 ? '' : 's'} applied` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5 max-w-2xl font-sans">
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.map(s => (
            <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">{s}</span>
          ))}
        </div>
      )}
      <Section title="Urgent" items={data.urgent ?? []} showAction />
      <Section title="Action required" items={data.actionRequired ?? []} showAction />
      <Section title="FYI" items={data.fyi ?? []} />
    </div>
  );
}
