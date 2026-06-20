'use client';

import { useEffect, useState } from 'react';
import { ACTION_TYPE_LABELS, auditStatusLabel } from '@/lib/harness/action-labels';
import type { QueueAuditEntry } from '@/lib/harness/queue-audit';

function formatResolvedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditTrailPanel() {
  const [entries, setEntries] = useState<QueueAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/queue/audit');
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const data = await res.json() as QueueAuditEntry[];
        if (!cancelled) setEntries(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load history');
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground-muted">
        Approved, rejected, saved, and sent queue actions — newest first.
      </p>

      {loading && (
        <p className="text-xs text-foreground-subtle">Loading…</p>
      )}

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-xs text-foreground-subtle">No queue actions recorded yet.</p>
      )}

      {entries.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border max-h-72 overflow-y-auto">
          {entries.map(entry => (
            <li key={entry.id} className="px-3 py-2.5 space-y-0.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-foreground leading-snug">{entry.summary}</p>
                <span className="text-[10px] text-foreground-subtle shrink-0 tabular-nums">
                  {formatResolvedAt(entry.resolvedAt)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-foreground-subtle">
                <span>{ACTION_TYPE_LABELS[entry.type] ?? entry.type}</span>
                <span>·</span>
                <span>{entry.agentRole}</span>
                <span>·</span>
                <span className="font-medium text-foreground-muted">
                  {auditStatusLabel(entry.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
