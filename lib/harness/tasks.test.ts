import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  queueActionToTask,
  sessionToTask,
  formatTaskTime,
} from './tasks';
import type { QueuedAction } from './queue';

function makeAction(overrides: Partial<QueuedAction> = {}): QueuedAction {
  return {
    id: 'action-1',
    type: 'email_reply',
    summary: 'Draft reply to Sarah',
    agentRole: 'dispatcher',
    tool: 'queue_action',
    payload: {},
    status: 'pending',
    priority: 'normal',
    createdAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('queueActionToTask', () => {
  it('maps pending queue items to needs_you', () => {
    const task = queueActionToTask(makeAction());
    expect(task.status).toBe('needs_you');
    expect(task.source).toBe('queue');
    expect(task.id).toBe('queue-action-1');
    expect(task.title).toBe('Draft reply to Sarah');
    expect(task.subtitle).toBe('Email reply · dispatcher');
  });

  it('maps approved items to done', () => {
    const task = queueActionToTask(makeAction({ status: 'approved' }));
    expect(task.status).toBe('done');
  });

  it('maps failed items to failed', () => {
    const task = queueActionToTask(makeAction({ status: 'failed' }));
    expect(task.status).toBe('failed');
  });
});

describe('sessionToTask', () => {
  it('describes a running studio session', () => {
    const task = sessionToTask({
      entityType: 'daily',
      activeAgents: 3,
      status: 'running',
    });
    expect(task?.status).toBe('running');
    expect(task?.title).toContain('Daily');
    expect(task?.title).toContain('3 agents');
  });

  it('describes a completed session', () => {
    const task = sessionToTask({
      entityType: 'company',
      activeAgents: 0,
      status: 'complete',
    });
    expect(task?.status).toBe('done');
    expect(task?.title).toContain('run complete');
  });
});

describe('formatTaskTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns now for recent timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:05:00.000Z'));
    expect(formatTaskTime('2026-06-01T10:04:30.000Z')).toBe('now');
  });

  it('returns minutes for times within an hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:30:00.000Z'));
    expect(formatTaskTime('2026-06-01T10:00:00.000Z')).toBe('30m');
  });
});
