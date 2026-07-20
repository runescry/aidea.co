import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueuedAction } from './queue-types';

const pending: QueuedAction = {
  id: 'queue-1',
  type: 'email_send',
  summary: 'Send update',
  agentRole: 'dispatcher',
  tool: 'gmail_send',
  payload: { to: 'person@example.com', subject: 'Update', body: 'Hello' },
  status: 'pending',
  priority: 'normal',
  createdAt: '2026-07-20T00:00:00.000Z',
};

let claimed = false;
const mockApprove = vi.fn(async (action: QueuedAction) => ({ ...action, status: 'executed' as const }));

vi.mock('@/lib/storage', () => ({
  getQueuedAction: vi.fn(async () => pending),
  claimQueuedAction: vi.fn(async (action: QueuedAction) => {
    if (claimed) return null;
    claimed = true;
    return { ...action, status: 'executing' as const };
  }),
  saveQueuedAction: vi.fn(),
  replaceQueue: vi.fn(),
  listQueuedActions: vi.fn(async () => []),
}));
vi.mock('./execute-queued-action', () => ({
  approveQueuedAction: (action: QueuedAction) => mockApprove(action),
  saveQueuedEmailDraft: vi.fn(),
}));
vi.mock('./queue-audit', () => ({ recordQueueAudit: vi.fn() }));
vi.mock('./tasks-cache', () => ({ invalidateDevTasksCache: vi.fn() }));
vi.mock('./knowledge-base', () => ({ readAllKB: vi.fn(), writeManyKB: vi.fn() }));

import { resolveQueueAction } from './queue';

describe('queue execution claim', () => {
  beforeEach(() => {
    claimed = false;
    mockApprove.mockClear();
  });

  it('allows only one concurrent resolver to execute an action', async () => {
    const [first, second] = await Promise.all([
      resolveQueueAction(pending.id, 'approve'),
      resolveQueueAction(pending.id, 'approve'),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(mockApprove).toHaveBeenCalledTimes(1);
  });
});
