import {
  getQueuedAction,
  saveQueuedAction,
  replaceQueue,
  listQueuedActions,
} from '@/lib/storage';
import { recordQueueAudit } from './queue-audit';
import { applyQueueEdits, normalizeEmailQueueAction } from './normalize-queue-action';
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
  const created: QueuedAction = {
    ...action,
    id: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await commitQueueAction(created);
  return created;
}

function applyEmailNormalization(action: QueuedAction): QueuedAction {
  if (action.type !== 'email_reply' && action.type !== 'email_send') return action;
  return { ...action, ...normalizeEmailQueueAction(action) };
}

export async function resolveQueueAction(
  id: string,
  intent: QueueIntent,
  edits?: QueueEditOverrides,
): Promise<QueuedAction | null> {
  const current = await getQueuedAction(id);
  if (!current || current.status !== 'pending') return null;

  let action = applyEmailNormalization(applyQueueEdits(current, edits));
  const resolvedAt = new Date().toISOString();

  if (intent === 'reject') {
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
