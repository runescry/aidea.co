import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  queueActionToTask,
  sessionToTask,
  entityStateToTask,
  buildUnifiedTaskFeed,
  sortTaskItems,
  taskToChatPrompt,
  formatTaskTime,
  latestBriefToTask,
  isTodayBrief,
  insertBriefTask,
  latestHealthBriefToTask,
  insertHealthTask,
} from './tasks';
import type { QueuedAction } from './queue-types';
import type { EntityState } from './types';

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

describe('entityStateToTask', () => {
  it('maps running entities to running tasks with preview title', () => {
    const entity: EntityState = {
      entityId: 'ent-1',
      entityType: 'daily',
      entityName: 'Morning brief',
      status: 'running',
      data: { brief: 'Today focus on inbox' },
      decisions: [],
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: '2026-06-01T09:05:00.000Z',
    };
    const task = entityStateToTask(entity);
    expect(task.status).toBe('running');
    expect(task.id).toBe('entity-ent-1');
    expect(task.title).toContain('Morning brief');
    expect(task.entityId).toBe('ent-1');
  });

  it('uses artifact preview for completed entities', () => {
    const entity: EntityState = {
      entityId: 'ent-2',
      entityType: 'company',
      entityName: 'Q2 plan',
      status: 'complete',
      data: { plan: 'Ship unified Work feed first' },
      decisions: [],
      createdAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-06-01T08:30:00.000Z',
    };
    const task = entityStateToTask(entity);
    expect(task.status).toBe('done');
    expect(task.title).toBe('Ship unified Work feed first');
  });
});

describe('buildUnifiedTaskFeed', () => {
  it('merges queue and entity tasks with needs_you first', () => {
    const now = new Date('2026-06-01T12:00:00.000Z').getTime();
    const { tasks, needsYou } = buildUnifiedTaskFeed({
      now,
      actions: [makeAction({ id: 'a1', status: 'pending' })],
      entities: [
        {
          entityId: 'e1',
          entityType: 'daily',
          entityName: 'Run',
          status: 'running',
          data: {},
          decisions: [],
          createdAt: '2026-06-01T11:00:00.000Z',
          updatedAt: '2026-06-01T11:30:00.000Z',
        },
      ],
    });
    expect(needsYou).toBe(1);
    expect(tasks[0].status).toBe('needs_you');
    expect(tasks.some(t => t.id === 'entity-e1')).toBe(true);
  });

  it('counts only queue items in needsYou, not proactive suggestions', () => {
    const now = new Date('2026-06-01T12:00:00.000Z').getTime();
    const { tasks, needsYou, suggestions } = buildUnifiedTaskFeed({
      now,
      actions: [makeAction({ id: 'a1', status: 'pending' })],
      entities: [],
      kb: {
        work: {
          currentProjects: {
            jobApplications: [{
              company: 'Acme',
              status: 'Interviewing',
              nextAction: 'Send thank-you note',
            }],
          },
        },
      },
    });
    expect(needsYou).toBe(1);
    expect(suggestions).toBe(1);
    expect(tasks.filter(t => t.status === 'suggestion')).toHaveLength(1);
  });

  it('drops completed entities older than seven days', () => {
    const now = new Date('2026-06-01T12:00:00.000Z').getTime();
    const { tasks } = buildUnifiedTaskFeed({
      now,
      actions: [],
      entities: [
        {
          entityId: 'old',
          entityType: 'daily',
          entityName: 'Old run',
          status: 'complete',
          data: {},
          decisions: [],
          createdAt: '2026-05-01T08:00:00.000Z',
          updatedAt: '2026-05-01T08:30:00.000Z',
        },
      ],
    });
    expect(tasks).toHaveLength(0);
  });

  it('includes today brief after approvals in the feed', () => {
    const now = new Date('2026-06-01T12:00:00.000Z').getTime();
    const { tasks } = buildUnifiedTaskFeed({
      now,
      actions: [makeAction({ id: 'a1', status: 'pending' })],
      entities: [],
      brief: {
        date: '2026-06-01',
        generatedAt: '2026-06-01T06:30:00.000Z',
        mustDo: [{ priority: 1, action: 'Reply to Sarah', context: 'Urgent', source: 'email' }],
        schedule: [],
        logistics: [],
        health: { todayWorkout: 'Rest', estimatedDurationMins: 0, intensity: 'rest', mealSuggestions: [], hydrationGoalLitres: 2, quickNote: '' },
        news: [],
        workPrep: { firstMeeting: null, attendeeContext: [], suggestedTalkingPoints: [], prepNotes: '' },
      },
    });
    const brief = tasks.find(t => t.source === 'brief');
    expect(brief).toBeDefined();
    expect(brief?.title).toContain('Morning brief');
    expect(tasks[0].status).toBe('needs_you');
    expect(tasks[1].source).toBe('brief');
  });

  it('includes health brief from entity state in feed', () => {
    const now = new Date('2026-06-01T12:00:00.000Z').getTime();
    const { tasks } = buildUnifiedTaskFeed({
      now,
      actions: [],
      entities: [{
        entityId: 'e1',
        entityType: 'daily',
        entityName: 'Daily',
        status: 'complete',
        data: {
          health_brief: {
            todayWorkout: 'Pull — back, biceps',
            intensity: 'moderate',
            mealSuggestions: [],
            hydrationGoalLitres: 2,
          },
        },
        decisions: [],
        createdAt: '2026-06-01T06:00:00.000Z',
        updatedAt: '2026-06-01T06:30:00.000Z',
      }],
    });
    expect(tasks.some(t => t.source === 'health')).toBe(true);
  });
});

describe('latestBriefToTask', () => {
  it('returns null for stale briefs', () => {
    expect(
      latestBriefToTask(
        { date: '2026-05-30', generatedAt: '2026-05-30T06:30:00.000Z', mustDo: [] },
        new Date('2026-06-01T12:00:00.000Z'),
      ),
    ).toBeNull();
  });

  it('maps must-do count to subtitle', () => {
    const task = latestBriefToTask(
      {
        date: '2026-06-01',
        generatedAt: '2026-06-01T06:30:00.000Z',
        mustDo: [{ action: 'A' }, { action: 'B' }],
      },
      new Date('2026-06-01T12:00:00.000Z'),
    );
    expect(task?.subtitle).toBe('2 priorities today');
    expect(isTodayBrief({ generatedAt: '2026-06-01T06:30:00.000Z' }, new Date('2026-06-01T12:00:00.000Z'))).toBe(true);
  });
});

describe('latestHealthBriefToTask', () => {
  it('returns null when no health_brief on entities', () => {
    expect(latestHealthBriefToTask([], new Date('2026-06-01T12:00:00.000Z'))).toBeNull();
  });

  it('surfaces today health brief from entity state', () => {
    const task = latestHealthBriefToTask([{
      entityId: 'e1',
      entityType: 'daily',
      entityName: 'Daily',
      status: 'complete',
      data: {
        health_brief: {
          todayWorkout: 'Push — chest, shoulders',
          estimatedDurationMins: 50,
          intensity: 'moderate',
          mealSuggestions: ['Breakfast: oats'],
          hydrationGoalLitres: 2.5,
        },
      },
      decisions: [],
      createdAt: '2026-06-01T06:00:00.000Z',
      updatedAt: '2026-06-01T06:30:00.000Z',
    }], new Date('2026-06-01T12:00:00.000Z'));
    expect(task?.source).toBe('health');
    expect(task?.title).toBe("Today's training");
    expect(task?.subtitle).toContain('Push');
  });

  it('drops stale health briefs from prior days', () => {
    const task = latestHealthBriefToTask([{
      entityId: 'e1',
      entityType: 'daily',
      entityName: 'Daily',
      status: 'complete',
      data: { health_brief: { todayWorkout: 'Rest day' } },
      decisions: [],
      createdAt: '2026-05-30T06:00:00.000Z',
      updatedAt: '2026-05-30T06:30:00.000Z',
    }], new Date('2026-06-01T12:00:00.000Z'));
    expect(task).toBeNull();
  });
});

describe('insertHealthTask', () => {
  it('pins health row after morning brief', () => {
    const brief = {
      id: 'brief-latest',
      source: 'brief' as const,
      status: 'done' as const,
      title: 'Morning brief',
      createdAt: '2026-06-01T06:30:00.000Z',
    };
    const health = {
      id: 'health-brief-latest',
      source: 'health' as const,
      status: 'done' as const,
      title: "Today's training",
      createdAt: '2026-06-01T06:35:00.000Z',
    };
    const other = {
      id: 'proactive-1',
      source: 'proactive' as const,
      status: 'suggestion' as const,
      title: 'Nudge',
      createdAt: '2026-06-01T09:00:00.000Z',
    };
    const ordered = insertHealthTask([brief, other], health);
    expect(ordered.map(t => t.id)).toEqual(['brief-latest', 'health-brief-latest', 'proactive-1']);
  });
});

describe('insertBriefTask', () => {
  it('pins brief after needs_you items', () => {
    const needsYou = {
      id: 'queue-1',
      source: 'queue' as const,
      status: 'needs_you' as const,
      title: 'Draft',
      createdAt: '2026-06-01T10:00:00.000Z',
    };
    const suggestion = {
      id: 'proactive-1',
      source: 'proactive' as const,
      status: 'suggestion' as const,
      title: 'Nudge',
      createdAt: '2026-06-01T09:00:00.000Z',
    };
    const brief = {
      id: 'brief-latest',
      source: 'brief' as const,
      status: 'done' as const,
      title: 'Morning brief',
      createdAt: '2026-06-01T06:30:00.000Z',
    };
    const ordered = insertBriefTask(sortTaskItems([suggestion, needsYou]), brief);
    expect(ordered.map(t => t.id)).toEqual(['queue-1', 'brief-latest', 'proactive-1']);
  });
});

describe('sortTaskItems', () => {
  it('orders by status then recency', () => {
    const sorted = sortTaskItems([
      {
        id: 'done',
        source: 'queue',
        status: 'done',
        title: 'Done',
        createdAt: '2026-06-01T10:00:00.000Z',
      },
      {
        id: 'needs',
        source: 'queue',
        status: 'needs_you',
        title: 'Needs',
        createdAt: '2026-06-01T09:00:00.000Z',
      },
    ]);
    expect(sorted[0].id).toBe('needs');
  });
});

describe('taskToChatPrompt', () => {
  it('builds a question with work item context', () => {
    const prompt = taskToChatPrompt(
      queueActionToTask(makeAction({ summary: 'Reply to Sarah', detail: 'Draft body here' })),
    );
    expect(prompt).toContain('Why did you draft this?');
    expect(prompt).toContain('Reply to Sarah');
    expect(prompt).toContain('Draft body here');
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
