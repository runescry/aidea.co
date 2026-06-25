'use client';

interface SchoolRoundupConcern {
  subject: string;
  action: string;
  reason?: string;
  messageId?: string;
  gmailUrl?: string;
  queueActionId?: string;
  tier: 'needs_you' | 'fyi';
}

interface EmailItem {
  from?: string;
  subject?: string;
  snippet?: string;
  urgency?: string;
  reason?: string;
  action?: string;
  messageId?: string;
  gmailUrl?: string;
  queueActionId?: string;
  attributionWarning?: string;
  kind?: string;
  school?: string;
  child?: string;
  emailCount?: number;
  concerns?: SchoolRoundupConcern[];
}

interface SchoolRoundupItem {
  subject: string;
  reason: string;
  action?: string;
  messageId?: string;
  gmailUrl?: string;
  queueActionId?: string;
}

interface SchoolRoundup {
  school: string;
  child: string;
  emailCount: number;
  needsYou: SchoolRoundupItem[];
  fyi: SchoolRoundupItem[];
}

interface InboxTriageData {
  urgent?: EmailItem[];
  actionRequired?: EmailItem[];
  fyi?: EmailItem[];
  schoolRoundups?: SchoolRoundup[];
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
  const isRoundup = item.kind === 'school_roundup';

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">
            {item.subject ?? 'No subject'}
          </div>
          {item.from && <div className="text-xs text-foreground-muted mt-0.5">{item.from}</div>}
          {isRoundup && item.emailCount != null && (
            <div className="text-[11px] text-accent mt-1">
              {item.emailCount} emails bundled
            </div>
          )}
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${URGENCY_STYLE[urgency] ?? URGENCY_STYLE.NORMAL}`}>
          {urgency}
        </span>
      </div>
      {!isRoundup && item.snippet && (
        <p className="text-xs text-foreground-muted border-l-2 border-border pl-2">{item.snippet}</p>
      )}
      {item.reason && item.reason !== item.snippet && !isRoundup && (
        <p className="text-xs text-foreground-muted">{item.reason}</p>
      )}
      {item.attributionWarning && (
        <p className="text-[11px] text-warning">{item.attributionWarning}</p>
      )}
      {isRoundup && item.concerns && item.concerns.length > 0 ? (
        <ul className="space-y-2 text-xs">
          {item.concerns.map((concern, ci) => (
            <li
              key={`${concern.messageId ?? concern.subject}-${ci}`}
              className={`border-l-2 pl-2 ${
                concern.tier === 'needs_you' ? 'border-danger/40' : 'border-border'
              }`}
            >
              {concern.gmailUrl ? (
                <a
                  href={concern.gmailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent hover:underline"
                >
                  {concern.subject}
                </a>
              ) : (
                <span className="font-medium text-foreground">{concern.subject}</span>
              )}
              <div className="text-foreground-muted mt-0.5">
                {concern.action?.trim() || concern.reason}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {showAction && item.action && !isRoundup && (
        <div className="text-xs text-foreground border-l-2 border-accent pl-2 whitespace-pre-wrap">
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

function SchoolRoundupCard({ roundup }: { roundup: SchoolRoundup }) {
  return (
    <div className="card p-3 space-y-3 border border-accent/20">
      <div>
        <div className="text-sm font-semibold text-foreground">
          {roundup.school} — {roundup.child}
        </div>
        <div className="text-xs text-foreground-muted">
          {roundup.emailCount} school emails this run
        </div>
      </div>
      {roundup.needsYou.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-danger">Needs you</div>
          <ul className="space-y-1.5 text-xs text-foreground">
            {roundup.needsYou.map((item, i) => (
              <li key={`need-${i}`} className="border-l-2 border-danger/40 pl-2">
                {item.gmailUrl ? (
                  <a href={item.gmailUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">
                    {item.subject}
                  </a>
                ) : (
                  <span className="font-medium">{item.subject}</span>
                )}
                <div className="text-foreground-muted mt-0.5">
                  {item.action?.trim() || item.reason}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {roundup.fyi.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle">FYI</div>
          <ul className="space-y-1 text-xs text-foreground-muted">
            {roundup.fyi.map((item, i) => (
              <li key={`fyi-${i}`}>
                {item.gmailUrl ? (
                  <a href={item.gmailUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {item.subject}
                  </a>
                ) : (
                  item.subject
                )}
                {item.reason && item.reason !== item.subject ? ` — ${item.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({ title, items, showAction }: { title: string; items: EmailItem[]; showAction?: boolean }) {
  const visible = items.filter(item => item.kind !== 'school_roundup');
  if (!visible.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle">{title}</h3>
      <div className="space-y-2">
        {visible.map((item, i) => (
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

  const roundups = data.schoolRoundups ?? [];
  const roundupSummaries = (data.actionRequired ?? []).filter(item => item.kind === 'school_roundup');

  return (
    <div className="space-y-5 max-w-2xl font-sans">
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.map(s => (
            <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">{s}</span>
          ))}
        </div>
      )}
      {roundups.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle">School roundups</h3>
          <div className="space-y-2">
            {roundups.map((roundup, i) => (
              <SchoolRoundupCard key={`${roundup.school}-${i}`} roundup={roundup} />
            ))}
          </div>
        </div>
      )}
      {roundups.length === 0 &&
        roundupSummaries.map((item, i) => (
          <EmailCard key={`rollup-${i}`} item={item} showAction />
        ))}
      <Section title="Urgent" items={data.urgent ?? []} showAction />
      <Section title="Action required" items={data.actionRequired ?? []} showAction />
      <Section title="FYI" items={data.fyi ?? []} />
    </div>
  );
}
