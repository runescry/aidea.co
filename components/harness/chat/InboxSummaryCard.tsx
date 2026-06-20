'use client';

export interface InboxSummaryItem {
  priority?: string;
  from?: string;
  subject?: string;
  snippet?: string;
}

export interface DispatchInboxStructured {
  summary?: string;
  inbox_summary?: InboxSummaryItem[];
  action?: string;
}

const PRIORITY_ORDER = ['HIGH', 'NORMAL', 'LOW'] as const;

const PRIORITY_LABEL: Record<string, string> = {
  HIGH: 'High priority',
  NORMAL: 'Other emails',
  LOW: 'Low priority',
};

const PRIORITY_STYLE: Record<string, string> = {
  HIGH: 'text-danger',
  NORMAL: 'text-foreground-muted',
  LOW: 'text-foreground-subtle',
};

function groupByPriority(items: InboxSummaryItem[]): Map<string, InboxSummaryItem[]> {
  const groups = new Map<string, InboxSummaryItem[]>();
  for (const item of items) {
    const key = (item.priority ?? 'NORMAL').toUpperCase();
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

function EmailRow({ item }: { item: InboxSummaryItem }) {
  const from = item.from?.trim() || 'Unknown sender';
  const subject = item.subject?.trim();
  const snippet = item.snippet?.trim();

  return (
    <li className="py-2 border-b border-border/50 last:border-0">
      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] text-foreground leading-snug">
          <span className="font-medium">{from}</span>
          {subject ? (
            <span className="text-foreground-muted"> — {subject}</span>
          ) : null}
        </div>
        {snippet ? (
          <p className="text-[12px] text-foreground-subtle leading-relaxed line-clamp-2">
            {snippet}
          </p>
        ) : null}
      </div>
    </li>
  );
}

interface Props {
  data: DispatchInboxStructured;
  fallbackMarkdown?: string;
}

export default function InboxSummaryCard({ data, fallbackMarkdown }: Props) {
  const items = data.inbox_summary ?? [];
  if (items.length === 0) return null;

  const groups = groupByPriority(items);
  const orderedKeys = [
    ...PRIORITY_ORDER.filter(k => groups.has(k)),
    ...[...groups.keys()].filter(k => !PRIORITY_ORDER.includes(k as typeof PRIORITY_ORDER[number])),
  ];

  return (
    <div className="space-y-4">
      {data.summary ? (
        <p className="text-sm text-foreground leading-relaxed">{data.summary}</p>
      ) : null}

      {orderedKeys.map(priority => {
        const groupItems = groups.get(priority);
        if (!groupItems?.length) return null;
        return (
          <section key={priority} className="space-y-1">
            <h4 className={`text-[11px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.NORMAL}`}>
              {PRIORITY_LABEL[priority] ?? priority}
            </h4>
            <ul className="divide-y divide-border/50 rounded-lg border border-border/60 bg-surface/50 px-3">
              {groupItems.map((item, i) => (
                <EmailRow key={`${priority}-${i}`} item={item} />
              ))}
            </ul>
          </section>
        );
      })}

      {data.action ? (
        <p className="text-[13px] text-foreground-muted pt-1 border-t border-border/60">
          <span className="font-medium text-foreground">Suggested action: </span>
          {data.action}
        </p>
      ) : fallbackMarkdown ? (
        <div className="text-[13px] text-foreground-muted pt-1 border-t border-border/60 leading-relaxed">
          {fallbackMarkdown.split('\n').slice(-2).join(' ').replace(/\*\*/g, '')}
        </div>
      ) : null}
    </div>
  );
}

export function isInboxStructured(data: unknown): data is DispatchInboxStructured {
  if (!data || typeof data !== 'object') return false;
  return Array.isArray((data as DispatchInboxStructured).inbox_summary);
}
