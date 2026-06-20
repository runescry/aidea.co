import type { ActionStatus } from '@/lib/harness/queue';

export async function patchQueueAction(
  id: string,
  status: ActionStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/queue', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return { ok: false, error: body.error ?? `Update failed (${res.status})` };
  }
  return { ok: true };
}
