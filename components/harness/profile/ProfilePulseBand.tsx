'use client';

import type { ProfilePulseItem, ProfilePulseKind } from '@/lib/profile/pulse';
import { profileLastActivityLabel } from '@/lib/profile/pulse';
import { formatTaskTime } from '@/lib/harness/tasks';

const KIND_LABEL: Record<ProfilePulseKind, string> = {
  focus: 'Today',
  pending: 'Review',
  nudge: 'People',
  change: 'Updated',
  sync: 'Synced',
};

const KIND_STYLE: Record<ProfilePulseKind, string> = {
  focus: 'bg-accent/10 text-accent border-accent/20',
  pending: 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/25',
  nudge: 'bg-violet-500/10 text-violet-800 dark:text-violet-200 border-violet-500/25',
  change: 'bg-surface-subtle text-foreground-muted border-border',
  sync: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/25',
};

interface Props {
  items: ProfilePulseItem[];
  loading?: boolean;
  onOpenChat: (draft: string) => void;
  onDismiss?: (pulseId: string) => void;
}

export default function ProfilePulseBand({ items, loading, onOpenChat, onDismiss }: Props) {
  const lastActivity = profileLastActivityLabel(items);

  return (
    <section className="rounded-xl border border-border bg-gradient-to-br from-accent/5 via-surface to-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">Live</h3>
          </div>
          <p className="text-xs text-foreground-muted mt-1">
            {loading && items.length === 0
              ? 'Syncing from agents and integrations…'
              : lastActivity
                ? `Last activity ${lastActivity} ago`
                : 'Updates appear here as agents learn and you chat.'}
          </p>
        </div>
      </div>

      {items.length === 0 && !loading ? (
        <p className="text-sm text-foreground-muted">
          Quiet right now. Ask in chat or let inbox triage run — changes will show up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map(item => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/80 px-3 py-2.5"
            >
              <span
                className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide border ${KIND_STYLE[item.kind]}`}
              >
                {KIND_LABEL[item.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground leading-snug">{item.title}</p>
                {(item.detail || item.source) && (
                  <p className="text-[11px] text-foreground-muted mt-0.5 truncate">
                    {[item.detail, item.source].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className="text-[10px] text-foreground-subtle tabular-nums">
                  {formatTaskTime(item.at)}
                </span>
                {item.chatPrompt && (
                  <button
                    type="button"
                    onClick={() => onOpenChat(item.chatPrompt!)}
                    className="text-[10px] text-accent hover:underline"
                  >
                    Chat →
                  </button>
                )}
                {onDismiss && item.kind !== 'focus' && (
                  <button
                    type="button"
                    onClick={() => onDismiss(item.id)}
                    className="text-[10px] text-foreground-subtle hover:text-foreground"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
