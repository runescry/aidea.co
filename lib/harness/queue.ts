import {
  listQueuedActions,
  replaceQueue,
} from '@/lib/storage';
import { applyKbPatch, kbPatchInputFromPayload } from './kb-updates';
import { executeQueuedAction } from './execute-queued-action';
import { recordQueueAudit } from './queue-audit';

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

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

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
  await replaceQueue(all);
  return created;
}

export async function updateActionStatus(
  id: string,
  status: ActionStatus
): Promise<QueuedAction | null> {
  const all = await listQueuedActions();
  const idx = all.findIndex(a => a.id === id);
  if (idx === -1) return null;

  const action = all[idx];
  const resolvedAt = new Date().toISOString();
  all[idx] = { ...action, status, resolvedAt };
  await replaceQueue(all);
  await recordQueueAudit({ ...action, status, resolvedAt });

  if (status === 'approved') {
    try {
      if (action.type === 'kb_update') {
        const patchInput = kbPatchInputFromPayload({
          ...action.payload,
          summary: action.summary,
        });
        if (!patchInput) throw new Error('Profile update had no changes to apply');
        await applyKbPatch(patchInput);
      } else if (action.tool === 'gmail_send' || action.tool === 'calendar_create') {
        await executeQueuedAction(action);
      }
      all[idx] = { ...all[idx], status: 'executed', resolvedAt: new Date().toISOString() };
      await replaceQueue(all);
      await recordQueueAudit(all[idx]);
    } catch {
      all[idx] = { ...all[idx], status: 'failed', resolvedAt: new Date().toISOString() };
      await replaceQueue(all);
      await recordQueueAudit(all[idx]);
    }
  }

  return all[idx];
}

export async function clearResolved(): Promise<number> {
  const all = await listQueuedActions();
  const remaining = all.filter(a => a.status === 'pending');
  const count = all.length - remaining.length;
  await replaceQueue(remaining);
  return count;
}
