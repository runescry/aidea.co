import type { QueuedAction } from './queue-types';
import type { EntityState } from './types';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { ACTION_TYPE_LABELS } from './action-labels';
import { sanitizeQueueSummary } from './kb-update-display';
import { buildProactiveTasks, type UserAutonomyPreference, type ProactiveHygiene, applyProactiveHygiene } from './proactive-tasks';
import { buildYesterdayTimeline, timelineToTaskItems, type TimelineEntry } from './timeline';
import { detectScheduleConflicts, conflictsToTaskItems, type ScheduleConflict } from './conflicts';
import type { QueueAuditEntry } from './queue-audit';

export type TaskStatus = 'needs_you' | 'suggestion' | 'running' | 'done' | 'failed';

export interface TaskItem {
  id: string;
  source: 'queue' | 'session' | 'proactive' | 'brief' | 'health' | 'timeline';
  status: TaskStatus;
  title: string;
  subtitle?: string;
  type?: string;
  agentRole?: string;
  priority?: QueuedAction['priority'];
  createdAt: string;
  action?: QueuedAction;
  entityId?: string;
  preview?: string;
  brief?: Record<string, unknown>;
  healthBrief?: Record<string, unknown>;
  timeline?: TimelineEntry;
  conflict?: ScheduleConflict;
  relationship?: {
    name: string;
    email?: string;
    type?: string;
    lastContact?: string;
    weeksSince?: number;
  };
}

const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  needs_you: 0,
  suggestion: 1,
  running: 2,
  failed: 3,
  done: 4,
};

export function sortTaskItems(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    const diff = TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status];
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function isTodayBrief(brief: Record<string, unknown>, now = new Date()): boolean {
  const generatedAt = brief.generatedAt;
  if (typeof generatedAt === 'string') {
    const parsed = new Date(generatedAt);
    if (!Number.isNaN(parsed.getTime())) return isSameCalendarDay(parsed, now);
  }
  const date = brief.date;
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) return isSameCalendarDay(parsed, now);
  }
  return false;
}

export function latestBriefToTask(
  brief: Record<string, unknown> | null | undefined,
  now = new Date(),
): TaskItem | null {
  if (!brief || typeof brief !== 'object' || !isTodayBrief(brief, now)) return null;

  const mustDo = Array.isArray(brief.mustDo) ? brief.mustDo : [];
  const priorityCount = mustDo.length;
  const generatedAt =
    typeof brief.generatedAt === 'string' && !Number.isNaN(new Date(brief.generatedAt).getTime())
      ? brief.generatedAt
      : now.toISOString();

  let title = 'Morning brief';
  if (typeof brief.date === 'string') {
    const parsed = new Date(brief.date);
    if (!Number.isNaN(parsed.getTime())) {
      title = `Morning brief · ${parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
    }
  }

  const firstMustDo = mustDo[0];
  const preview =
    firstMustDo &&
    typeof firstMustDo === 'object' &&
    firstMustDo !== null &&
    typeof (firstMustDo as { action?: unknown }).action === 'string'
      ? (firstMustDo as { action: string }).action
      : undefined;

  return {
    id: 'brief-latest',
    source: 'brief',
    status: 'done',
    title,
    subtitle: priorityCount > 0 ? `${priorityCount} priorit${priorityCount === 1 ? 'y' : 'ies'} today` : 'Daily brief',
    preview,
    createdAt: generatedAt,
    brief,
  };
}

/** Pin today's brief after approvals, before other items. */
export function insertBriefTask(tasks: TaskItem[], briefTask: TaskItem | null): TaskItem[] {
  if (!briefTask) return tasks;
  const withoutBrief = tasks.filter(t => t.source !== 'brief');
  const sorted = sortTaskItems(withoutBrief);
  const needsYouCount = sorted.filter(t => t.status === 'needs_you').length;
  return [...sorted.slice(0, needsYouCount), briefTask, ...sorted.slice(needsYouCount)];
}

export function latestHealthBriefToTask(
  entities: EntityState[],
  now = new Date(),
): TaskItem | null {
  let latest: { data: Record<string, unknown>; updatedAt: string } | null = null;

  for (const entity of entities) {
    const brief = entity.data.health_brief as Record<string, unknown> | undefined;
    const workout = brief?.todayWorkout;
    if (typeof workout !== 'string' || !workout.trim()) continue;
    if (!latest || entity.updatedAt > latest.updatedAt) {
      latest = { data: brief!, updatedAt: entity.updatedAt };
    }
  }

  if (!latest) return null;
  const updatedAt = new Date(latest.updatedAt);
  if (Number.isNaN(updatedAt.getTime()) || !isSameCalendarDay(updatedAt, now)) return null;

  const workout = String(latest.data.todayWorkout);
  const intensity = typeof latest.data.intensity === 'string' ? latest.data.intensity : undefined;

  return {
    id: 'health-brief-latest',
    source: 'health',
    status: 'done',
    title: "Today's training",
    subtitle: intensity && intensity !== 'rest'
      ? `${workout} · ${intensity}`
      : workout,
    preview: Array.isArray(latest.data.mealSuggestions) && latest.data.mealSuggestions[0]
      ? String(latest.data.mealSuggestions[0])
      : undefined,
    createdAt: latest.updatedAt,
    healthBrief: latest.data,
  };
}

/** Pin today's health brief immediately after the morning brief row. */
export function insertHealthTask(tasks: TaskItem[], healthTask: TaskItem | null): TaskItem[] {
  if (!healthTask) return tasks.filter(t => t.source !== 'health');
  const withoutHealth = tasks.filter(t => t.source !== 'health');
  const briefIdx = withoutHealth.findIndex(t => t.source === 'brief');
  if (briefIdx === -1) {
    const needsYouCount = withoutHealth.filter(t => t.status === 'needs_you').length;
    return [...withoutHealth.slice(0, needsYouCount), healthTask, ...withoutHealth.slice(needsYouCount)];
  }
  return [
    ...withoutHealth.slice(0, briefIdx + 1),
    healthTask,
    ...withoutHealth.slice(briefIdx + 1),
  ];
}

export function countNeedsYou(tasks: TaskItem[]): number {
  return tasks.filter(t => t.status === 'needs_you' && t.source === 'queue').length;
}

export function countSuggestions(tasks: TaskItem[]): number {
  return tasks.filter(t => t.status === 'suggestion').length;
}

function queueStatusToTaskStatus(status: QueuedAction['status']): TaskStatus {
  if (status === 'pending') return 'needs_you';
  if (status === 'failed') return 'failed';
  return 'done';
}

export function queueActionToTask(action: QueuedAction): TaskItem {
  const typeLabel = ACTION_TYPE_LABELS[action.type] ?? action.type;
  const title = action.type === 'kb_update'
    ? sanitizeQueueSummary(action.summary)
    : action.summary;
  return {
    id: `queue-${action.id}`,
    source: 'queue',
    status: queueStatusToTaskStatus(action.status),
    title,
    subtitle: `${typeLabel} · ${action.agentRole}`,
    type: action.type,
    agentRole: action.agentRole,
    priority: action.priority,
    createdAt: action.createdAt,
    action,
  };
}

export function sessionToTask(input: {
  entityType?: string;
  activeAgents: number;
  status: 'starting' | 'running' | 'paused' | 'complete' | 'error';
  entityId?: string;
}): TaskItem | null {
  const label = input.entityType
    ? input.entityType.charAt(0).toUpperCase() + input.entityType.slice(1)
    : 'Agent run';

  const status: TaskStatus =
    input.status === 'starting' || input.status === 'running' || input.status === 'paused'
      ? 'running'
      : input.status === 'error'
        ? 'failed'
        : 'done';

  return {
    id: input.entityId ? `entity-${input.entityId}` : 'session-active',
    source: 'session',
    status,
    entityId: input.entityId,
    title:
      status === 'running'
        ? input.status === 'starting'
          ? `${label} — starting…`
          : `${label} — ${input.activeAgents} agent${input.activeAgents === 1 ? '' : 's'} working`
        : status === 'failed'
          ? `${label} — run failed`
          : `${label} — run complete`,
    subtitle: 'Studio session',
    createdAt: new Date().toISOString(),
  };
}

function artifactPreviewFromEntityData(data: Record<string, unknown>): string | undefined {
  for (const value of Object.values(data)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      const line = value.trim().split('\n')[0];
      return line.length > 80 ? `${line.slice(0, 77)}…` : line;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = artifactPreviewFromEntityData(value as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return undefined;
}

export function entityStateToTask(entity: EntityState): TaskItem {
  const typeLabel = entity.entityType.charAt(0).toUpperCase() + entity.entityType.slice(1);
  const status: TaskStatus =
    entity.status === 'running' || entity.status === 'paused'
      ? 'running'
      : entity.status === 'error'
        ? 'failed'
        : 'done';

  const preview = artifactPreviewFromEntityData(entity.data);
  let title: string;
  if (status === 'running') {
    title = `${entity.entityName} — in progress`;
  } else if (status === 'failed') {
    title = `${entity.entityName} — failed`;
  } else {
    title = preview ?? `${entity.entityName} — complete`;
  }

  return {
    id: `entity-${entity.entityId}`,
    source: 'session',
    status,
    entityId: entity.entityId,
    title,
    subtitle: preview && status === 'done' ? `${typeLabel} · deliverable` : `${typeLabel} run`,
    preview: status === 'done' ? preview : undefined,
    createdAt: entity.updatedAt,
  };
}

const RECENT_ENTITY_MS = 7 * 24 * 60 * 60 * 1000;
/** Runs left "running" after disconnect/timeout — treat as failed in Work feed. */
export const STALE_RUNNING_ENTITY_MS = 45 * 60 * 1000;
/** Runs that never wrote artifacts — likely a dropped SSE / killed function. */
export const STALE_EMPTY_RUN_MS = 5 * 60 * 1000;

const BOOTSTRAP_DATA_KEYS = new Set([
  'currentDate', 'currentTime', 'dayOfWeek', 'command', 'conversationHistory',
]);

function entityHasRunProgress(entity: EntityState): boolean {
  return Object.keys(entity.data).some(key => !BOOTSTRAP_DATA_KEYS.has(key));
}

export function isStaleRunningEntity(entity: EntityState, now = Date.now()): boolean {
  if (entity.status !== 'running' && entity.status !== 'paused') return false;
  const age = now - new Date(entity.updatedAt).getTime();
  if (!entityHasRunProgress(entity) && age > STALE_EMPTY_RUN_MS) return true;
  return age > STALE_RUNNING_ENTITY_MS;
}

export function normalizeEntityForFeed(entity: EntityState, now = Date.now()): EntityState {
  if (!isStaleRunningEntity(entity, now)) return entity;
  return { ...entity, status: 'error' };
}

export function buildUnifiedTaskFeed(input: {
  actions: QueuedAction[];
  entities: EntityState[];
  kb?: KnowledgeBase;
  brief?: Record<string, unknown> | null;
  audit?: QueueAuditEntry[];
  proactiveHygiene?: ProactiveHygiene;
  now?: number;
}): {
  tasks: TaskItem[];
  needsYou: number;
  suggestions: number;
  timeline: TaskItem[];
  autonomy?: UserAutonomyPreference;
} {
  const nowMs = input.now ?? Date.now();
  const nowDate = new Date(nowMs);
  const queueTasks = input.actions.map(queueActionToTask);

  const entityTasks = input.entities
    .filter(entity => {
      const normalized = normalizeEntityForFeed(entity, nowMs);
      if (normalized.status === 'running' || normalized.status === 'paused') return true;
      return nowMs - new Date(normalized.updatedAt).getTime() <= RECENT_ENTITY_MS;
    })
    .map(entity => entityStateToTask(normalizeEntityForFeed(entity, nowMs)));

  const conflictTasks = input.kb
    ? conflictsToTaskItems(detectScheduleConflicts({
        kb: input.kb,
        brief: input.brief,
        entities: input.entities,
        now: nowDate,
      }))
    : [];
  const proactiveTasksRaw = input.kb
    ? [...buildProactiveTasks({ kb: input.kb, entities: input.entities }), ...conflictTasks]
    : conflictTasks;
  const proactiveTasks = input.proactiveHygiene
    ? applyProactiveHygiene(proactiveTasksRaw, input.proactiveHygiene, nowDate)
    : proactiveTasksRaw;
  const existingIds = new Set([...queueTasks, ...entityTasks].map(t => t.id));
  const dedupedProactive = proactiveTasks.filter(t => !existingIds.has(t.id));

  const timeline = timelineToTaskItems(buildYesterdayTimeline({
    audit: input.audit,
    entities: input.entities,
    brief: input.brief,
    now: nowDate,
  }));

  const briefTask = latestBriefToTask(input.brief, nowDate);
  const healthTask = latestHealthBriefToTask(input.entities, nowDate);
  const tasks = insertHealthTask(
    insertBriefTask(
      sortTaskItems([...queueTasks, ...dedupedProactive, ...entityTasks]),
      briefTask,
    ),
    healthTask,
  );
  return {
    tasks,
    needsYou: countNeedsYou(tasks),
    suggestions: countSuggestions(tasks),
    timeline,
    autonomy: input.kb?.preferences?.defaultAutonomyLevel,
  };
}

export function taskToChatPrompt(
  task: TaskItem,
  question = 'Why did you draft this?',
): string {
  if (task.source === 'health') {
    const lines = ['Help me follow today\'s training plan.', '', `Work item: ${task.title}`];
    if (task.subtitle) lines.push(task.subtitle);
    if (task.preview) lines.push('', task.preview);
    return lines.join('\n');
  }
  if (task.source === 'proactive' && task.relationship) {
    const rel = task.relationship;
    const lines = [
      `Help me reconnect with ${rel.name}.`,
      '',
      `Work item: ${task.title}`,
    ];
    if (rel.type) lines.push(`Type: ${rel.type}`);
    if (rel.weeksSince) lines.push(`Last contact: ~${rel.weeksSince} week${rel.weeksSince === 1 ? '' : 's'} ago`);
    if (rel.email) lines.push(`Email: ${rel.email}`);
    lines.push('', 'Draft a personal check-in email or suggest how I should reach out.');
    return lines.join('\n');
  }
  const lines = [question, '', `Work item: ${task.title}`];
  if (task.subtitle) lines.push(task.subtitle);
  if (task.action?.detail) {
    lines.push('', task.action.detail);
  } else if (task.action) {
    const typeLabel = ACTION_TYPE_LABELS[task.action.type] ?? task.action.type;
    lines.push('', `${typeLabel} from ${task.action.agentRole}`);
  }
  return lines.join('\n');
}

export function formatTaskTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
