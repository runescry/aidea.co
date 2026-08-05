'use client';

import type { TaskItem } from '@/lib/harness/tasks';
import { decodeBriefText, mustDoCardLines } from '@/lib/harness/morning-brief-must-do';

interface MustDoItem {
  priority?: number;
  action?: string;
  subject?: string;
  context?: string;
  detail?: string;
  snippet?: string;
  gmailUrl?: string;
  from?: string;
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
  const topItems = mustDo
    .map(item => mustDoCardLines(item as Record<string, unknown>))
    .filter(line => line.title.length > 0)
    .slice(0, 3);

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
        <ol className="space-y-2.5 pl-4 list-decimal marker:text-foreground-subtle">
          {topItems.map((line, i) => {
            const title = decodeBriefText(line.title);
            const sender = line.sender ? decodeBriefText(line.sender) : undefined;
            const subline = line.subline ? decodeBriefText(line.subline) : undefined;
            const titleText = sender ? `${title} · ${sender}` : title;

            return (
              <li key={i} className="text-[12px] leading-snug">
                {line.gmailUrl ? (
                  <a
                    href={line.gmailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    {titleText}
                  </a>
                ) : (
                  <span className="font-medium text-foreground">{titleText}</span>
                )}
                {subline && (
                  <p className="mt-0.5 text-[11px] text-foreground-muted line-clamp-2">{subline}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
