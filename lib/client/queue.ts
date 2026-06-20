import type { QueuedAction, QueueEditOverrides, QueueIntent } from '@/lib/harness/queue-types';

export type { QueueEditOverrides, QueueIntent, QueuedAction };

export interface QueuePatchResult {
  id: string;
  ok: boolean;
  action?: QueuedAction;
  error?: string;
}

export interface QueuePatchSummary {
  total: number;
  succeeded: number;
  failed: number;
  notFound: number;
}

function summarizeResults(results: QueuePatchResult[]): QueuePatchSummary {
  return {
    total: results.length,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok && r.error !== 'Action not found').length,
    notFound: results.filter(r => r.error === 'Action not found').length,
  };
}

async function parsePatchResponse(
  res: Response,
): Promise<{ results: QueuePatchResult[]; summary: QueuePatchSummary } | { error: string }> {
  const body = await res.json().catch(() => ({})) as {
    error?: string;
    action?: QueuedAction;
    results?: Array<{ id: string; action?: QueuedAction | null; error?: string }>;
  };

  if (!res.ok) {
    return { error: body.error ?? `Update failed (${res.status})` };
  }

  if (Array.isArray(body.results)) {
    const results: QueuePatchResult[] = body.results.map(item => ({
      id: item.id,
      ok: Boolean(item.action),
      action: item.action ?? undefined,
      error: item.error ?? (item.action ? undefined : 'Action not found'),
    }));
    return { results, summary: summarizeResults(results) };
  }

  if (body.action) {
    const results: QueuePatchResult[] = [{
      id: body.action.id,
      ok: true,
      action: body.action,
    }];
    return { results, summary: summarizeResults(results) };
  }

  return { error: 'No results returned from server' };
}

export async function patchQueueAction(
  id: string,
  intent: QueueIntent,
  edits?: QueueEditOverrides,
): Promise<{ ok: true; action: QueuedAction } | { ok: false; error: string }> {
  const parsed = await parsePatchResponse(await fetch('/api/queue', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, intent, ...(edits ? { edits } : {}) }),
  }));

  if ('error' in parsed) return { ok: false, error: parsed.error };
  const first = parsed.results[0];
  if (!first?.action) return { ok: false, error: first?.error ?? 'No action returned from server' };
  return { ok: true, action: first.action };
}

export async function patchQueueActions(
  ids: string[],
  intent: QueueIntent,
  editsById?: Record<string, QueueEditOverrides>,
): Promise<
  | { ok: true; results: QueuePatchResult[]; summary: QueuePatchSummary }
  | { ok: false; error: string }
> {
  if (ids.length === 0) {
    return { ok: false, error: 'No items selected' };
  }

  const parsed = await parsePatchResponse(await fetch('/api/queue', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids,
      intent,
      ...(editsById && Object.keys(editsById).length > 0 ? { editsById } : {}),
    }),
  }));

  if ('error' in parsed) return { ok: false, error: parsed.error };
  return { ok: true, ...parsed };
}
