import type { QueuedAction } from './queue';
import type { EntityState } from './types';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { ACTION_TYPE_LABELS } from './action-labels';
import { sanitizeQueueSummary } from './kb-update-display';
import { buildProactiveTasks, type UserAutonomyPreference } from './proactive-tasks';

export type TaskStatus = 'needs_you' | 'suggestion' | 'running' | 'done' | 'failed';

export interface TaskItem {
  id: string;
  source: 'queue' | 'session' | 'proactive';
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
  now?: number;
}): {
  tasks: TaskItem[];
  needsYou: number;
  suggestions: number;
  autonomy?: UserAutonomyPreference;
} {
  const now = input.now ?? Date.now();
  const queueTasks = input.actions.map(queueActionToTask);

  const entityTasks = input.entities
    .filter(entity => {
      const normalized = normalizeEntityForFeed(entity, now);
      if (normalized.status === 'running' || normalized.status === 'paused') return true;
      return now - new Date(normalized.updatedAt).getTime() <= RECENT_ENTITY_MS;
    })
    .map(entity => entityStateToTask(normalizeEntityForFeed(entity, now)));

  const proactiveTasks = input.kb ? buildProactiveTasks({ kb: input.kb, entities: input.entities }) : [];
  const existingIds = new Set([...queueTasks, ...entityTasks].map(t => t.id));
  const dedupedProactive = proactiveTasks.filter(t => !existingIds.has(t.id));

  const tasks = sortTaskItems([...queueTasks, ...dedupedProactive, ...entityTasks]);
  return {
    tasks,
    needsYou: countNeedsYou(tasks),
    suggestions: countSuggestions(tasks),
    autonomy: input.kb?.preferences?.defaultAutonomyLevel,
  };
}

export function taskToChatPrompt(
  task: TaskItem,
  question = 'Why did you draft this?',
): string {
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
