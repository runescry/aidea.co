import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildProactiveTasks,
  readProactiveHygiene,
  applyProactiveHygiene,
  dismissProactiveTask,
  snoozeProactiveTask,
  addSnoozeDays,
} from './proactive-tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';
import type { EntityState } from './types';

describe('buildProactiveTasks', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('surfaces finance subscription renewals', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T12:00:00.000Z'));
    const kb: KnowledgeBase = {
      finance: {
        subscriptions: [{ name: 'Netflix', renewsOn: '2026-06-23', amount: 15, cadence: 'monthly' }],
      },
    };
    const tasks = buildProactiveTasks({ kb, entities: [] });
    expect(tasks.some(t => t.id === 'proactive-finance-renew-netflix')).toBe(true);
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
          coolingRelationships: [{
            name: 'Sarah',
            email: 'sarah@example.com',
            type: 'mentor',
            weeksSince: 4,
            lastContact: '2026-05-01',
            draftQueued: false,
          }],
        },
      },
      decisions: [],
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    }];
    const tasks = buildProactiveTasks({ kb: {}, entities });
    expect(tasks[0].title).toContain('Sarah');
    expect(tasks[0].relationship).toMatchObject({
      name: 'Sarah',
      email: 'sarah@example.com',
      type: 'mentor',
      weeksSince: 4,
    });
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

  it('skips removed contacts in relationship nudges', () => {
    const entities: EntityState[] = [{
      entityId: 'e1',
      entityType: 'personal',
      entityName: 'Personal',
      status: 'complete',
      data: {
        relationship_monitor: {
          checkedAt: '2026-06-01T10:00:00.000Z',
          coolingRelationships: [{
            name: 'Sarah',
            email: 'sarah@example.com',
            type: 'mentor',
            weeksSince: 4,
            lastContact: '2026-05-01',
            draftQueued: false,
          }],
        },
      },
      decisions: [],
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    }];
    const kb: KnowledgeBase = {
      relationships: {
        people: [{ id: 'p1', name: 'Sarah', email: 'sarah@example.com', status: 'removed' }],
        removedKeys: ['sarah@example.com'],
      },
    };
    expect(buildProactiveTasks({ kb, entities })).toHaveLength(0);
  });
});

describe('proactive hygiene', () => {
  const kb: KnowledgeBase = {
    work: {
      currentProjects: {
        jobApplications: [
          { company: 'Acme', nextAction: 'Follow up', status: 'In progress' },
        ],
      },
    },
  };

  it('hides dismissed proactive tasks', () => {
    const tasks = buildProactiveTasks({ kb, entities: [] });
    const hygiene = dismissProactiveTask(readProactiveHygiene({}), 'proactive-job-acme');
    expect(applyProactiveHygiene(tasks, hygiene)).toHaveLength(0);
  });

  it('hides snoozed tasks until the snooze date', () => {
    const tasks = buildProactiveTasks({ kb, entities: [] });
    const now = new Date('2026-06-01T12:00:00.000Z');
    const hygiene = snoozeProactiveTask(
      readProactiveHygiene({}),
      'proactive-job-acme',
      addSnoozeDays(now, 7),
    );
    expect(applyProactiveHygiene(tasks, hygiene, now)).toHaveLength(0);
    expect(applyProactiveHygiene(tasks, hygiene, addSnoozeDays(now, 8))).toHaveLength(1);
  });

  it('reads hygiene arrays from profile', () => {
    const hygiene = readProactiveHygiene({
      proactiveDismissed: ['proactive-job-acme'],
      proactiveSnoozed: { 'proactive-rel-sarah': '2026-06-08T00:00:00.000Z' },
    });
    expect(hygiene.dismissed).toEqual(['proactive-job-acme']);
    expect(hygiene.snoozed['proactive-rel-sarah']).toBe('2026-06-08T00:00:00.000Z');
  });
});
