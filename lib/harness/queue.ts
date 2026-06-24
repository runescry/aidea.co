import {
  getQueuedAction,
  saveQueuedAction,
  replaceQueue,
  listQueuedActions,
} from '@/lib/storage';
import { recordQueueAudit } from './queue-audit';
import {
  applyQueueEdits,
  normalizeCalendarQueueAction,
  normalizeEmailQueueAction,
} from './normalize-queue-action';
import type {
  ActionStatus,
  ActionType,
  QueuedAction,
  QueueEditOverrides,
  QueueIntent,
} from './queue-types';

export type { ActionStatus, ActionType, QueuedAction, QueueEditOverrides, QueueIntent };
export { ACTION_TYPE_LABELS } from './action-labels';
import {
  approveQueuedAction,
  saveQueuedEmailDraft,
} from './execute-queued-action';
import { invalidateDevTasksCache } from './tasks-cache';
import { readAllKB, writeManyKB } from './knowledge-base';
import { buildKbPatchRejectionUpdate } from '@/lib/profile/memory-hygiene';
import { autonomyForAction, shouldAutoExecuteAction } from './domain-autonomy';
import type { KnowledgeBase } from '@/types/knowledge-base';

const AUTO_EXECUTABLE_TYPES = new Set<ActionType>(['email_reply', 'email_send', 'calendar_event']);

/** Stable key for collapsing duplicate pending queue items. */
export function queueDedupeKey(action: Pick<QueuedAction, 'type' | 'payload' | 'summary'>): string {
  const payload = action.payload as Record<string, unknown>;
  if (action.type === 'email_reply' || action.type === 'email_send') {
    const threadId = payload.threadId as string | undefined;
    if (threadId) return `${action.type}:thread:${threadId}`;
    const replyId = payload.replyToMessageId as string | undefined;
    if (replyId) return `${action.type}:reply:${replyId}`;
    const to = (payload.to as string | undefined)?.trim().toLowerCase();
    const subject = (payload.subject as string | undefined)?.trim().toLowerCase().slice(0, 60);
    if (to) return `${action.type}:to:${to}:${subject ?? ''}`;
  }
  if (action.type === 'kb_update') {
    const input = payload.input as Record<string, unknown> | undefined;
    const job = input?.jobApplication as { company?: string } | undefined;
    if (job?.company) return `kb_update:job:${job.company.toLowerCase()}`;
    const person = input?.person as { email?: string; name?: string } | undefined;
    if (person?.email) return `kb_update:person:${person.email.toLowerCase()}`;
    if (person?.name) return `kb_update:person:${person.name.toLowerCase()}`;
  }
  if (action.type === 'calendar_event') {
    const title = (payload.title as string | undefined)?.trim().toLowerCase();
    const start = payload.start as string | undefined;
    if (title && start) return `calendar:${title}:${start}`;
  }
  return `${action.type}:${action.summary.trim().toLowerCase().slice(0, 100)}`;
}

async function findPendingDuplicate(
  action: Omit<QueuedAction, 'id' | 'status' | 'createdAt'>,
): Promise<QueuedAction | null> {
  const key = queueDedupeKey(action);
  const pending = await listQueuedActions({ status: 'pending' });
  return pending.find(a => queueDedupeKey(a) === key) ?? null;
}

/** Keep newest pending item per dedupe key; drop older duplicates. */
export async function collapsePendingQueueDuplicates(): Promise<number> {
  const all = await listQueuedActions();
  const pending = all.filter(a => a.status === 'pending');
  const rest = all.filter(a => a.status !== 'pending');
  const byKey = new Map<string, QueuedAction>();
  for (const action of pending.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )) {
    const key = queueDedupeKey(action);
    if (!byKey.has(key)) byKey.set(key, action);
  }
  const kept = [...byKey.values()];
  const removed = pending.length - kept.length;
  if (removed > 0) {
    await replaceQueue([...rest, ...kept]);
    invalidateDevTasksCache();
  }
  return removed;
}

export async function listActions(filter?: { status?: ActionStatus; type?: ActionType }): Promise<QueuedAction[]> {
  return listQueuedActions(filter);
}

async function commitQueueAction(action: QueuedAction): Promise<void> {
  await saveQueuedAction(action);
  invalidateDevTasksCache();
}

export async function enqueueAction(
  action: Omit<QueuedAction, 'id' | 'status' | 'createdAt'>
): Promise<QueuedAction> {
  const existing = await findPendingDuplicate(action);
  if (existing) {
    const updated: QueuedAction = {
      ...existing,
      summary: action.summary,
      detail: action.detail,
      payload: action.payload,
      priority: action.priority,
      tool: action.tool,
      agentRole: action.agentRole,
      entityId: action.entityId,
      createdAt: new Date().toISOString(),
    };
    await commitQueueAction(updated);
    return updated;
  }

  const created: QueuedAction = {
    ...action,
    id: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await commitQueueAction(created);
  return created;
}

export async function enqueueActionWithAutonomy(
  action: Omit<QueuedAction, 'id' | 'status' | 'createdAt'>,
  options?: { requireApproval?: boolean },
): Promise<QueuedAction> {
  const kb = await readAllKB() as KnowledgeBase;
  const autoExecute = shouldAutoExecuteAction(
    autonomyForAction(kb, action.type),
    options?.requireApproval,
  ) && AUTO_EXECUTABLE_TYPES.has(action.type);

  const created = await enqueueAction(action);
  if (!autoExecute) return created;

  try {
    const result = await approveQueuedAction(created);
    const updated = {
      ...created,
      ...result,
      resolvedAt: new Date().toISOString(),
      payload: result.payload ?? created.payload,
    };
    await commitQueueAction(updated);
    await recordQueueAudit(updated);
    return updated;
  } catch (err) {
    const failed: QueuedAction = {
      ...created,
      status: 'failed',
      resolvedAt: new Date().toISOString(),
      payload: {
        ...created.payload,
        executionError: err instanceof Error ? err.message : String(err),
      },
    };
    await commitQueueAction(failed);
    await recordQueueAudit(failed);
    return failed;
  }
}

function applyQueueNormalization(action: QueuedAction): QueuedAction {
  if (action.type === 'email_reply' || action.type === 'email_send') {
    return { ...action, ...normalizeEmailQueueAction(action) };
  }
  if (action.type === 'calendar_event') {
    return { ...action, ...normalizeCalendarQueueAction(action) };
  }
  return action;
}

export async function resolveQueueAction(
  id: string,
  intent: QueueIntent,
  edits?: QueueEditOverrides,
): Promise<QueuedAction | null> {
  const current = await getQueuedAction(id);
  if (!current || current.status !== 'pending') return null;

  let action = applyQueueNormalization(applyQueueEdits(current, edits));
  const resolvedAt = new Date().toISOString();

  if (intent === 'reject') {
    if (action.type === 'kb_update') {
      const kb = await readAllKB() as KnowledgeBase;
      await writeManyKB(buildKbPatchRejectionUpdate(kb, {
        summary: action.summary,
        agentRole: action.agentRole,
      }));
    }
    const updated = { ...action, status: 'rejected' as const, resolvedAt };
    await commitQueueAction(updated);
    await recordQueueAudit(updated);
    return updated;
  }

  if (intent === 'save') {
    try {
      if (action.type !== 'email_reply' && action.type !== 'email_send') {
        throw new Error('Only email drafts can be saved to Gmail');
      }
      const draft = await saveQueuedEmailDraft(action) as {
        draftId: string; messageId: string; subject: string; connectionId: string;
      };
      const updated = {
        ...action,
        status: 'saved' as const,
        resolvedAt,
        payload: {
          ...action.payload,
          gmailDraftId: draft.draftId,
          gmailMessageId: draft.messageId,
          connectionId: draft.connectionId,
        },
      };
      await commitQueueAction(updated);
      await recordQueueAudit(updated);
      return updated;
    } catch (err) {
      const updated = {
        ...action,
        status: 'failed' as const,
        resolvedAt,
        payload: {
          ...action.payload,
          executionError: err instanceof Error ? err.message : String(err),
        },
      };
      await commitQueueAction(updated);
      await recordQueueAudit(updated);
      return updated;
    }
  }

  // approve — send or apply
  try {
    const result = await approveQueuedAction(action);
    const updated = {
      ...action,
      ...result,
      resolvedAt: new Date().toISOString(),
      payload: result.payload ?? action.payload,
    };
    await commitQueueAction(updated);
    await recordQueueAudit(updated);
    return updated;
  } catch (err) {
    const updated = {
      ...action,
      status: 'failed' as const,
      resolvedAt,
      payload: {
        ...action.payload,
        executionError: err instanceof Error ? err.message : String(err),
      },
    };
    await commitQueueAction(updated);
    await recordQueueAudit(updated);
    return updated;
  }
}

export interface QueueBulkResult {
  id: string;
  action: QueuedAction | null;
  error?: string;
}

export async function resolveQueueActions(
  ids: string[],
  intent: QueueIntent,
  editsById?: Record<string, QueueEditOverrides>,
): Promise<QueueBulkResult[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const results: QueueBulkResult[] = [];

  for (const id of uniqueIds) {
    const action = await resolveQueueAction(id, intent, editsById?.[id]);
    results.push({
      id,
      action,
      error: action ? undefined : 'Action not found',
    });
  }

  return results;
}

/** @deprecated Use resolveQueueAction with intent instead */
export async function updateActionStatus(
  id: string,
  status: ActionStatus,
): Promise<QueuedAction | null> {
  if (status === 'rejected') return resolveQueueAction(id, 'reject');
  if (status === 'approved') return resolveQueueAction(id, 'approve');
  return null;
}

export async function clearResolved(): Promise<number> {
  const all = await listQueuedActions();
  const remaining = all.filter(a => a.status === 'pending');
  const count = all.length - remaining.length;
  await replaceQueue(remaining);
  invalidateDevTasksCache();
  return count;
}
