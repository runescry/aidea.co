import { describe, it, expect } from 'vitest';
import { buildProactiveTasks } from './proactive-tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';
import type { EntityState } from './types';

describe('buildProactiveTasks', () => {
  it('surfaces stale job application next actions', () => {
    const kb: KnowledgeBase = {
      work: {
        currentProjects: {
          jobApplications: [
            { company: 'Acme', role: 'PM', status: 'In progress', nextAction: 'Send follow-up email' },
          ],
        },
      },
    };
    const tasks = buildProactiveTasks({ kb, entities: [] });
    expect(tasks.some(t => t.id === 'proactive-job-acme')).toBe(true);
    expect(tasks[0].source).toBe('proactive');
  });

  it('surfaces cooling relationships without queued drafts', () => {
    const entities: EntityState[] = [{
      entityId: 'e1',
      entityType: 'personal',
      entityName: 'Personal',
      status: 'complete',
      data: {
        relationship_monitor: {
          checkedAt: '2026-06-01T10:00:00.000Z',
          coolingRelationships: [{ name: 'Sarah', weeksSince: 4, draftQueued: false }],
        },
      },
      decisions: [],
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    }];
    const tasks = buildProactiveTasks({ kb: {}, entities });
    expect(tasks[0].title).toContain('Sarah');
  });

  it('skips declined applications', () => {
    const kb: KnowledgeBase = {
      work: {
        currentProjects: {
          jobApplications: [
            { company: 'OldCo', nextAction: 'Follow up', status: 'Declined' },
          ],
        },
      },
    };
    expect(buildProactiveTasks({ kb, entities: [] })).toHaveLength(0);
  });
});
