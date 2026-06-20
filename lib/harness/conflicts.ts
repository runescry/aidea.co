import type { KnowledgeBase } from '@/types/knowledge-base';
import type { EntityState } from './types';
import type { TaskItem } from './tasks';

export interface ScheduleConflict {
  id: string;
  kind: 'schedule_vs_health' | 'brief_vs_health';
  title: string;
  description: string;
  calendarHint?: string;
  healthHint?: string;
  day: string;
}

const REST_PATTERN = /rest|off|recovery|skip/i;
const WORKOUT_PATTERN = /gym|workout|train|run|ride|swim|lift|pull|push|legs|cardio/i;
const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function dayKey(now: Date): string {
  return DAY_KEYS[now.getDay()];
}

function isRestWorkout(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return REST_PATTERN.test(value);
}

function looksLikeWorkout(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  if (isRestWorkout(value)) return false;
  return WORKOUT_PATTERN.test(value) || value.trim().length > 2;
}

function healthBriefWorkout(input: {
  entities?: EntityState[];
  brief?: Record<string, unknown> | null;
}): { workout?: string; intensity?: string } {
  const fromBrief = input.brief?.health;
  if (fromBrief && typeof fromBrief === 'object' && fromBrief !== null) {
    const health = fromBrief as { todayWorkout?: string; intensity?: string };
    if (typeof health.todayWorkout === 'string') {
      return { workout: health.todayWorkout, intensity: health.intensity };
    }
  }

  let latest: { workout: string; intensity?: string; updatedAt: string } | null = null;
  for (const entity of input.entities ?? []) {
    const brief = entity.data.health_brief as { todayWorkout?: string; intensity?: string } | undefined;
    if (typeof brief?.todayWorkout !== 'string') continue;
    if (!latest || entity.updatedAt > latest.updatedAt) {
      latest = { workout: brief.todayWorkout, intensity: brief.intensity, updatedAt: entity.updatedAt };
    }
  }
  return latest ? { workout: latest.workout, intensity: latest.intensity } : {};
}

export function detectScheduleConflicts(input: {
  kb?: KnowledgeBase;
  brief?: Record<string, unknown> | null;
  entities?: EntityState[];
  now?: Date;
}): ScheduleConflict[] {
  const now = input.now ?? new Date();
  const day = now.toISOString().slice(0, 10);
  const scheduled = input.kb?.health?.workoutSchedule?.[dayKey(now)];
  const { workout: healthWorkout, intensity } = healthBriefWorkout(input);
  const conflicts: ScheduleConflict[] = [];

  if (scheduled && looksLikeWorkout(scheduled) && healthWorkout && isRestWorkout(healthWorkout)) {
    conflicts.push({
      id: `conflict-schedule-${day}`,
      kind: 'schedule_vs_health',
      title: 'Training plan conflict',
      description: 'Your KB schedule expects a workout today, but the health brief recommends rest.',
      calendarHint: scheduled,
      healthHint: intensity ? `${healthWorkout} (${intensity})` : healthWorkout,
      day,
    });
  }

  return conflicts;
}

export function conflictsToTaskItems(conflicts: ScheduleConflict[]): TaskItem[] {
  return conflicts.map(conflict => ({
    id: conflict.id,
    source: 'proactive',
    status: 'suggestion',
    title: conflict.title,
    subtitle: conflict.description,
    preview: [conflict.calendarHint, conflict.healthHint].filter(Boolean).join(' · '),
    createdAt: new Date().toISOString(),
    conflict,
  }));
}
