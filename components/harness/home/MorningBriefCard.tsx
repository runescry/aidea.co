'use client';

import type { TaskItem } from '@/lib/harness/tasks';

interface MustDoItem {
  priority?: number;
  action?: string;
  context?: string;
  gmailUrl?: string;
}

export default function MorningBriefCard({
  task,
  onOpenInbox,
}: {
  task: TaskItem;
  onOpenInbox?: () => void;
}) {
  const mustDo = Array.isArray(task.brief?.mustDo)
    ? (task.brief!.mustDo as MustDoItem[])
    : [];
  const topItems = mustDo.slice(0, 3);

  return (
    <div className="shrink-0 rounded-xl border border-border bg-surface-subtle/60 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-accent">Today&apos;s brief</p>
          <h3 className="text-[13px] font-semibold text-foreground truncate">{task.title}</h3>
          {task.subtitle && (
            <p className="text-[11px] text-foreground-subtle mt-0.5">{task.subtitle}</p>
          )}
        </div>
        {onOpenInbox && (
          <button
            type="button"
            onClick={onOpenInbox}
            className="shrink-0 text-[11px] font-medium text-accent hover:text-accent/80"
          >
            Inbox →
          </button>
        )}
      </div>
      {topItems.length > 0 && (
        <ol className="space-y-1 pl-4 list-decimal marker:text-foreground-subtle">
          {topItems.map((item, i) => (
            <li key={i} className="text-[12px] text-foreground-muted leading-snug">
              {item.gmailUrl ? (
                <a
                  href={item.gmailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {item.action ?? 'Priority item'}
                </a>
              ) : (
                item.action ?? 'Priority item'
              )}
              {item.context ? (
                <span className="text-foreground-subtle"> · {item.context}</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
