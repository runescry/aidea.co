import { listQueuedActions, saveQueuedAction } from '@/lib/storage';
import type { QueuedAction } from './queue-types';

const FEED_RESOLVED_LIMIT = 50;

/** Drop legacy full-profile blobs from kb_update payloads — keep input/reason for UI + approve. */
export function slimQueuedActionForFeed(action: QueuedAction): QueuedAction {
  if (action.type !== 'kb_update') return action;

  const payload = { ...action.payload };
  const patch = payload.patch as Record<string, unknown> | undefined;
  if (patch && typeof patch === 'object') {
    const { work, family, goals, ...rest } = patch;
    const hasInput = payload.input != null;
    if (hasInput || work || family || goals) {
      if (Object.keys(rest).length > 0) {
        payload.patch = rest;
      } else {
        delete payload.patch;
      }
    }
  }

  return { ...action, payload };
}

function selectActionsForFeed(all: QueuedAction[]): QueuedAction[] {
  const pending = all.filter(a => a.status === 'pending');
  const failed = all.filter(a => a.status === 'failed');
  const resolved = all
    .filter(a => a.status !== 'pending' && a.status !== 'failed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, FEED_RESOLVED_LIMIT);

  const seen = new Set<string>();
  const merged: QueuedAction[] = [];
  for (const action of [...pending, ...failed, ...resolved]) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    merged.push(slimQueuedActionForFeed(action));
  }
  return merged;
}

export async function listActionsForFeed(): Promise<QueuedAction[]> {
  const all = await listQueuedActions();
  return selectActionsForFeed(all);
}

/** Persist slim payloads for legacy kb_update rows (dev recovery). Returns rows updated. */
export async function scrubQueuePayloadBloat(): Promise<number> {
  const all = await listQueuedActions();
  let updated = 0;

  for (const action of all) {
    if (action.type !== 'kb_update') continue;
    const slim = slimQueuedActionForFeed(action);
    const before = JSON.stringify(action.payload);
    const after = JSON.stringify(slim.payload);
    if (before === after) continue;
    await saveQueuedAction(slim);
    updated += 1;
  }

  return updated;
}
