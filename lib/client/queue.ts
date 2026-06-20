import type { ActionStatus } from '@/lib/harness/queue';

export async function patchQueueAction(id: string, status: ActionStatus): Promise<void> {
  await fetch('/api/queue', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
}
