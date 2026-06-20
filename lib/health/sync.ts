import type { KnowledgeBase } from '@/types/knowledge-base';

export interface HealthActivity {
  type: string;
  at: string;
  durationMins?: number;
  notes?: string;
}

export interface HealthSyncSnapshot {
  provider?: 'strava' | 'apple_health' | 'whoop' | 'manual';
  lastSyncedAt?: string;
  recentActivities: HealthActivity[];
}

export interface WeekTrainingSummary {
  weekStart: string;
  weekEnd: string;
  activities: HealthActivity[];
  totalSessions: number;
  totalMins: number;
  scheduledDays: string[];
}

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function startOfWeek(now: Date): Date {
  const start = new Date(now);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function readHealthSyncSnapshot(kb: KnowledgeBase): HealthSyncSnapshot {
  const sync = kb.health?.sync;
  return {
    provider: sync?.provider,
    lastSyncedAt: sync?.lastSyncedAt,
    recentActivities: [...(sync?.recentActivities ?? [])],
  };
}

export function weekTrainingSummary(kb: KnowledgeBase, now = new Date()): WeekTrainingSummary {
  const weekStartDate = startOfWeek(now);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  weekEndDate.setHours(23, 59, 59, 999);
  const activities = readHealthSyncSnapshot(kb).recentActivities.filter(a => {
    const t = new Date(a.at).getTime();
    return !Number.isNaN(t) && t >= weekStartDate.getTime() && t <= weekEndDate.getTime();
  });
  const schedule = kb.health?.workoutSchedule ?? {};
  return {
    weekStart: weekStartDate.toISOString().slice(0, 10),
    weekEnd: weekEndDate.toISOString().slice(0, 10),
    activities,
    totalSessions: activities.length,
    totalMins: activities.reduce((s, a) => s + (a.durationMins ?? 0), 0),
    scheduledDays: DAY_KEYS.filter(d => typeof schedule[d] === 'string' && schedule[d]!.trim()),
  };
}
