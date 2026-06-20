import type { QueuedAction } from './queue';
import { ACTION_TYPE_LABELS } from './action-labels';

export type TaskStatus = 'needs_you' | 'running' | 'done' | 'failed';

export interface TaskItem {
  id: string;
  source: 'queue' | 'session';
  status: TaskStatus;
  title: string;
  subtitle?: string;
  type?: string;
  agentRole?: string;
  priority?: QueuedAction['priority'];
  createdAt: string;
  action?: QueuedAction;
}

function queueStatusToTaskStatus(status: QueuedAction['status']): TaskStatus {
  if (status === 'pending') return 'needs_you';
  if (status === 'failed') return 'failed';
  return 'done';
}

export function queueActionToTask(action: QueuedAction): TaskItem {
  const typeLabel = ACTION_TYPE_LABELS[action.type] ?? action.type;
  return {
    id: `queue-${action.id}`,
    source: 'queue',
    status: queueStatusToTaskStatus(action.status),
    title: action.summary,
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
  status: 'running' | 'paused' | 'complete' | 'error';
}): TaskItem | null {
  const label = input.entityType
    ? input.entityType.charAt(0).toUpperCase() + input.entityType.slice(1)
    : 'Agent run';

  const status: TaskStatus =
    input.status === 'running' || input.status === 'paused'
      ? 'running'
      : input.status === 'error'
        ? 'failed'
        : 'done';

  return {
    id: 'session-active',
    source: 'session',
    status,
    title:
      status === 'running'
        ? `${label} — ${input.activeAgents} agent${input.activeAgents === 1 ? '' : 's'} working`
        : status === 'failed'
          ? `${label} — run failed`
          : `${label} — run complete`,
    subtitle: 'Studio session',
    createdAt: new Date().toISOString(),
  };
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
