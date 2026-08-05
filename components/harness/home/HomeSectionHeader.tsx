'use client';

import { IconExpand, IconMinimize, IconRefresh } from '../sidebar/icons';

interface Props {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  titleUppercase?: boolean;
  onSync?: () => void;
  syncing?: boolean;
}

export default function HomeSectionHeader({
  title,
  subtitle,
  expanded,
  onToggleExpand,
  titleUppercase = false,
  onSync,
  syncing = false,
}: Props) {
  return (
    <div className="shrink-0 flex items-start justify-between gap-3 px-3 py-2.5 border-b border-border sm:px-4 lg:px-6">
      <div className="min-w-0">
        <h3
          className={
            titleUppercase
              ? 'text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle'
              : 'text-[13px] font-semibold text-foreground'
          }
        >
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-foreground-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium text-foreground-muted hover:text-foreground hover:bg-surface-subtle border border-transparent hover:border-border transition-colors disabled:opacity-50"
            aria-label={syncing ? 'Syncing school email' : 'Sync school email now'}
            title="Pull latest school email from Gmail"
          >
            <IconRefresh className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync now'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleExpand}
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-subtle border border-transparent hover:border-border transition-colors"
          aria-label={expanded ? 'Restore split view' : `Expand ${title}`}
          title={expanded ? 'Restore split view' : 'Expand to full screen'}
        >
          {expanded ? <IconMinimize className="w-4 h-4" /> : <IconExpand className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
