'use client';
import { useEffect, useState } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { readHealthSyncSnapshot, weekTrainingSummary } from '@/lib/health/sync';

export default function HealthLensPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [kb, setKb] = useState<KnowledgeBase>({});
  useEffect(() => {
    fetch('/api/kb').then(r => r.json()).then(d => setKb(d as KnowledgeBase)).catch(() => {});
  }, [refreshKey]);
  const week = weekTrainingSummary(kb);
  const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
  return (
    <section className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">This week&apos;s training</h3>
      <p className="text-xs text-foreground-muted">{
          readHealthSyncSnapshot(kb).lastSyncedAt
            ? `Last sync (${readHealthSyncSnapshot(kb).provider ?? 'manual'}): ${new Date(readHealthSyncSnapshot(kb).lastSyncedAt!).toLocaleDateString()}`
            : 'Log activities under health.sync or connect a wearable when available.'
        }</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-surface-subtle/80 p-3 border border-border/50">
          <div className="text-xs text-foreground-subtle">Today ({day})</div>
          <div className="font-medium">{kb.health?.workoutSchedule?.[day] ?? 'Not set'}</div>
        </div>
        <div className="rounded-lg bg-surface-subtle/80 p-3 border border-border/50">
          <div className="text-xs text-foreground-subtle">This week</div>
          <div className="font-medium">{week.totalSessions} activities</div>
        </div>
      </div>
    </section>
  );
}
