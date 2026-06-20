import type { QueuedAction, QueueIntent } from '@/lib/harness/queue';

export async function patchQueueAction(
  id: string,
  intent: QueueIntent,
): Promise<{ ok: true; action: QueuedAction } | { ok: false; error: string }> {
  const res = await fetch('/api/queue', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, intent }),
  });
  const body = await res.json().catch(() => ({})) as { error?: string; action?: QueuedAction };
  if (!res.ok) {
    return { ok: false, error: body.error ?? `Update failed (${res.status})` };
  }
  if (!body.action) {
    return { ok: false, error: 'No action returned from server' };
  }
  return { ok: true, action: body.action };
}
