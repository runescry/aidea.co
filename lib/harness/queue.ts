import {
  listQueuedActions,
  replaceQueue,
} from '@/lib/storage';
import { recordQueueAudit } from './queue-audit';
import { normalizeEmailQueueAction } from './normalize-queue-action';
import {
  approveQueuedAction,
  saveQueuedEmailDraft,
} from './execute-queued-action';
import { invalidateDevTasksCache } from './tasks-cache';

export type ActionType =
  | 'email_reply'
  | 'email_send'
  | 'calendar_event'
  | 'task'
  | 'reminder'
  | 'message'
  | 'alert'
  | 'kb_update'
  | 'generic';

export { ACTION_TYPE_LABELS } from './action-labels';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'saved';

/** User intent from Inbox: send, save to Gmail drafts, or dismiss. */
export type QueueIntent = 'approve' | 'save' | 'reject';

export interface QueuedAction {
  id: string;
  type: ActionType;
  summary: string;
  detail?: string;
  agentRole: string;
  entityId?: string;
  tool: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
  resolvedAt?: string;
}

export async function listActions(filter?: { status?: ActionStatus; type?: ActionType }): Promise<QueuedAction[]> {
  return listQueuedActions(filter);
}

async function persistQueue(all: QueuedAction[]): Promise<void> {
  await replaceQueue(all);
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
  const all = await listQueuedActions();
  all.push(created);
  await persistQueue(all);
  return created;
}

function applyEmailNormalization(action: QueuedAction): QueuedAction {
  if (action.type !== 'email_reply' && action.type !== 'email_send') return action;
  return { ...action, ...normalizeEmailQueueAction(action) };
}

export async function resolveQueueAction(
  id: string,
  intent: QueueIntent,
): Promise<QueuedAction | null> {
  const all = await listQueuedActions();
  const idx = all.findIndex(a => a.id === id);
  if (idx === -1) return null;

  let action = applyEmailNormalization(all[idx]);
  const resolvedAt = new Date().toISOString();

  if (intent === 'reject') {
    all[idx] = { ...action, status: 'rejected', resolvedAt };
    await persistQueue(all);
    await recordQueueAudit(all[idx]);
    return all[idx];
  }

  if (intent === 'save') {
    try {
      if (action.type !== 'email_reply' && action.type !== 'email_send') {
        throw new Error('Only email drafts can be saved to Gmail');
      }
      const draft = await saveQueuedEmailDraft(action) as {
        draftId: string; messageId: string; subject: string; connectionId: string;
      };
      all[idx] = {
        ...action,
        status: 'saved',
        resolvedAt,
        payload: {
          ...action.payload,
          gmailDraftId: draft.draftId,
          gmailMessageId: draft.messageId,
          connectionId: draft.connectionId,
        },
      };
      await persistQueue(all);
      await recordQueueAudit(all[idx]);
      return all[idx];
    } catch (err) {
      all[idx] = {
        ...action,
        status: 'failed',
        resolvedAt,
        payload: {
          ...action.payload,
          executionError: err instanceof Error ? err.message : String(err),
        },
      };
      await persistQueue(all);
      await recordQueueAudit(all[idx]);
      return all[idx];
    }
  }

  // approve — send or apply
  try {
    const result = await approveQueuedAction(action);
    all[idx] = {
      ...action,
      ...result,
      resolvedAt: new Date().toISOString(),
      payload: result.payload ?? action.payload,
    };
    await persistQueue(all);
    await recordQueueAudit(all[idx]);
    return all[idx];
  } catch (err) {
    all[idx] = {
      ...action,
      status: 'failed',
      resolvedAt,
      payload: {
        ...action.payload,
        executionError: err instanceof Error ? err.message : String(err),
      },
    };
    await persistQueue(all);
    await recordQueueAudit(all[idx]);
    return all[idx];
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
): Promise<QueueBulkResult[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const results: QueueBulkResult[] = [];

  for (const id of uniqueIds) {
    const action = await resolveQueueAction(id, intent);
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
  await persistQueue(remaining);
  return count;
}
