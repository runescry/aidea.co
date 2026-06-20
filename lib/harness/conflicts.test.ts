import { describe, expect, it } from 'vitest';
import { detectScheduleConflicts, conflictsToTaskItems } from './conflicts';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('detectScheduleConflicts', () => {
  it('detects KB schedule workout vs health rest day', () => {
    const kb: KnowledgeBase = { health: { workoutSchedule: { Mon: 'Pull — back, biceps' } } };
    const conflicts = detectScheduleConflicts({
      kb,
      entities: [{
        entityId: 'e1', entityType: 'daily', entityName: 'Daily', status: 'complete',
        data: { health_brief: { todayWorkout: 'Rest day', intensity: 'rest' } },
        decisions: [], createdAt: '2026-06-01T12:00:00.000Z', updatedAt: '2026-06-01T12:00:00.000Z',
      }],
      now: new Date('2026-06-01T12:00:00.000Z'),
    });
    expect(conflicts[0].kind).toBe('schedule_vs_health');
  });
});

describe('conflictsToTaskItems', () => {
  it('maps conflicts to proactive suggestions', () => {
    const tasks = conflictsToTaskItems([{
      id: 'c1', kind: 'schedule_vs_health', title: 'Conflict', description: 'desc', day: '2026-06-01',
    }]);
    expect(tasks[0].source).toBe('proactive');
  });
});
