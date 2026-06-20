'use client';

import { useEffect, useState } from 'react';
import type { IntegrationStatus } from '@/lib/integrations';

interface Props {
  onOpenSettings?: () => void;
  refreshKey?: number;
}

export default function IntegrationStatusBar({ onOpenSettings, refreshKey = 0 }: Props) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => (r.ok ? r.json() : null))
      .then(data => setStatus(data as IntegrationStatus | null))
      .catch(() => setStatus(null));
  }, [refreshKey]);

  if (!status || status.missingCount === 0) return null;

  return (
    <div className="shrink-0 px-3 py-2 border-b border-border bg-surface-subtle/50 lg:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[11px] text-foreground-muted">Setup needed:</span>
        {status.integrations
          .filter(i => !i.configured)
          .map(item => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              {item.label}
            </span>
          ))}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-[11px] font-medium text-accent hover:text-accent/80 ml-auto"
          >
            Open Settings →
          </button>
        )}
      </div>
    </div>
  );
}
