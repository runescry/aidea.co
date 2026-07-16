'use client';

import type { KnowledgeBase } from '@/types/knowledge-base';
import { readHealthSyncSnapshot, weekTrainingSummary } from '@/lib/health/sync';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function formatActivity(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

interface Props {
  data: KnowledgeBase;
}

export default function HealthLensPanel({ data }: Props) {
  const week = weekTrainingSummary(data);
  const sync = readHealthSyncSnapshot(data);
  const today = DAY_KEYS[new Date().getDay()];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-title text-foreground">This week&apos;s training</h3>
        <p className="text-xs text-foreground-subtle mt-0.5">
          {sync.lastSyncedAt
            ? `Last sync (${sync.provider ?? 'manual'}): ${new Date(sync.lastSyncedAt).toLocaleDateString()}`
            : 'Connect Strava in Settings or log activities under health.sync.'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-surface-subtle/80 p-3 border border-border/50">
          <div className="text-xs text-foreground-subtle">Today ({today})</div>
          <div className="font-medium mt-0.5">{data.health?.workoutSchedule?.[today] ?? 'Not set'}</div>
        </div>
        <div className="rounded-lg bg-surface-subtle/80 p-3 border border-border/50">
          <div className="text-xs text-foreground-subtle">Activities</div>
          <div className="font-medium mt-0.5">{week.totalSessions} this week</div>
        </div>
        <div className="rounded-lg bg-surface-subtle/80 p-3 border border-border/50">
          <div className="text-xs text-foreground-subtle">Active minutes</div>
          <div className="font-medium mt-0.5">{week.totalMins > 0 ? `${week.totalMins} min` : '—'}</div>
        </div>
      </div>
      {week.activities.length > 0 ? (
        <ul className="space-y-2">
          {week.activities.map((activity, i) => (
            <li
              key={`${activity.at}-${i}`}
              className="flex items-start justify-between gap-3 rounded-lg px-3 py-2 border border-border/60 bg-surface-subtle/50 text-sm"
            >
              <div>
                <div className="font-medium text-foreground">{activity.type}</div>
                {activity.notes && (
                  <div className="text-xs text-foreground-subtle mt-0.5">{activity.notes}</div>
                )}
              </div>
              <div className="text-xs text-foreground-muted shrink-0 text-right">
                <div>{formatActivity(activity.at)}</div>
                {activity.durationMins != null && <div>{activity.durationMins} min</div>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-foreground-subtle">
          No synced activities this week. Set your workout schedule below or sync from Strava.
        </p>
      )}
    </div>
  );
}
