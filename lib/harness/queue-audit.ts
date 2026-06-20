import type { ActionStatus, ActionType } from './queue';
import { appendQueueAuditEntry, listQueueAuditEntries } from '@/lib/storage';

export interface QueueAuditEntry {
  id: string;
  actionId: string;
  type: ActionType;
  summary: string;
  agentRole: string;
  status: ActionStatus;
  resolvedAt: string;
}

const AUDIT_STATUSES: ActionStatus[] = ['approved', 'rejected', 'executed', 'failed', 'saved'];

export function shouldAuditStatus(status: ActionStatus): boolean {
  return AUDIT_STATUSES.includes(status);
}

export async function recordQueueAudit(action: {
  id: string;
  type: ActionType;
  summary: string;
  agentRole: string;
  status: ActionStatus;
  resolvedAt?: string;
}): Promise<QueueAuditEntry | null> {
  if (!shouldAuditStatus(action.status)) return null;

  const entry: QueueAuditEntry = {
    id: crypto.randomUUID(),
    actionId: action.id,
    type: action.type,
    summary: action.summary,
    agentRole: action.agentRole,
    status: action.status,
    resolvedAt: action.resolvedAt ?? new Date().toISOString(),
  };

  await appendQueueAuditEntry(entry);
  return entry;
}

export async function listQueueAudit(limit = 100): Promise<QueueAuditEntry[]> {
  const all = await listQueueAuditEntries();
  return all.slice(-limit).reverse();
}
