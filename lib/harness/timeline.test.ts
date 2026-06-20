import { describe, expect, it } from 'vitest';
import { buildYesterdayTimeline, timelineToTaskItems } from './timeline';
import type { QueueAuditEntry } from './queue-audit';

describe('buildYesterdayTimeline', () => {
  it('includes audit entries resolved yesterday', () => {
    const audit: QueueAuditEntry[] = [{
      id: 'a1', actionId: 'q1', type: 'email_reply', summary: 'Reply to Sarah',
      agentRole: 'dispatcher', status: 'approved', resolvedAt: '2026-06-01T15:00:00.000Z',
    }];
    const entries = buildYesterdayTimeline({ audit, now: new Date('2026-06-02T12:00:00.000Z') });
    expect(entries[0].domain).toBe('email');
  });
});

describe('timelineToTaskItems', () => {
  it('maps entries to timeline task items', () => {
    const tasks = timelineToTaskItems([{ id: 'audit-a1', domain: 'email', title: 'Reply sent', at: '2026-06-01T15:00:00.000Z' }]);
    expect(tasks[0].source).toBe('timeline');
  });
});
