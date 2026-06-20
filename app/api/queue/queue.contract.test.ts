import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from './route';
import type { QueuedAction } from '@/lib/harness/queue-types';

const mockResolve = vi.fn();

vi.mock('@/lib/harness/queue', () => ({
  resolveQueueAction: (...args: unknown[]) => mockResolve(...args),
  resolveQueueActions: vi.fn(),
  listActions: vi.fn(),
  clearResolved: vi.fn(),
}));

describe('PATCH /api/queue', () => {
  beforeEach(() => {
    mockResolve.mockReset();
  });

  it('returns 400 when intent is missing', async () => {
    const req = new Request('http://localhost/api/queue', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'q1' }),
    });
    const res = await PATCH(req as import('next/server').NextRequest);
    expect(res.status).toBe(400);
  });

  it('approves calendar_event with edits', async () => {
    const action: QueuedAction = {
      id: 'cal-1',
      type: 'calendar_event',
      summary: 'Calendar: Sync',
      agentRole: 'dispatcher',
      tool: 'calendar_create',
      payload: { title: 'Sync', start: '2026-06-01T14:00:00.000Z', durationMinutes: 30 },
      status: 'executed',
      priority: 'normal',
      createdAt: '2026-06-01T10:00:00.000Z',
    };
    mockResolve.mockResolvedValue(action);

    const req = new Request('http://localhost/api/queue', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'cal-1',
        intent: 'approve',
        edits: { title: 'Updated sync', durationMinutes: 45 },
      }),
    });
    const res = await PATCH(req as import('next/server').NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action.type).toBe('calendar_event');
    expect(mockResolve).toHaveBeenCalledWith('cal-1', 'approve', {
      title: 'Updated sync',
      durationMinutes: 45,
    });
  });

  it('approves kb_update queue item', async () => {
    const action: QueuedAction = {
      id: 'kb-1',
      type: 'kb_update',
      summary: 'Acme → Interviewing',
      agentRole: 'dispatcher',
      tool: 'update_kb',
      payload: { input: { jobApplication: { company: 'Acme', status: 'Interviewing' } } },
      status: 'executed',
      priority: 'normal',
      createdAt: '2026-06-01T10:00:00.000Z',
    };
    mockResolve.mockResolvedValue(action);

    const req = new Request('http://localhost/api/queue', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'kb-1', intent: 'approve' }),
    });
    const res = await PATCH(req as import('next/server').NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action.type).toBe('kb_update');
  });
});
