import { describe, expect, it } from 'vitest';
import { buildProfilePulse, profileLastActivityLabel } from './pulse';
import type { TaskItem } from '@/lib/harness/tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';

const now = new Date('2026-06-20T12:00:00.000Z').getTime();

describe('buildProfilePulse', () => {
  it('surfaces pending kb updates first', () => {
    const tasks: TaskItem[] = [
      {
        id: 'queue-kb-1',
        source: 'queue',
        status: 'needs_you',
        type: 'kb_update',
        title: 'Acme → interview scheduled',
        createdAt: '2026-06-20T10:00:00.000Z',
        action: { type: 'kb_update', agentRole: 'inbox-triage' } as TaskItem['action'],
      },
      {
        id: 'brief-latest',
        source: 'brief',
        status: 'done',
        title: 'Morning brief',
        createdAt: '2026-06-20T06:30:00.000Z',
        brief: { mustDo: [{ action: 'Reply to Sarah' }] },
      },
    ];
    const pulse = buildProfilePulse({ kb: {}, tasks, timeline: [], now });
    expect(pulse[0].kind).toBe('pending');
    expect(pulse[0].title).toContain('Acme');
  });

  it('includes today focus from morning brief', () => {
    const tasks: TaskItem[] = [{
      id: 'brief-latest',
      source: 'brief',
      status: 'done',
      title: 'Morning brief',
      subtitle: '2 priorities today',
      createdAt: '2026-06-20T06:30:00.000Z',
      brief: { mustDo: [{ action: 'Finalize deck' }] },
    }];
    const pulse = buildProfilePulse({ kb: {}, tasks, timeline: [], now });
    expect(pulse.some(p => p.kind === 'focus' && p.title === 'Finalize deck')).toBe(true);
  });

  it('includes relationship nudges and strava sync', () => {
    const kb: KnowledgeBase = {
      health: {
        sync: {
          lastSyncedAt: '2026-06-20T08:00:00.000Z',
          recentActivities: [{ type: 'Run', at: '2026-06-20T07:00:00.000Z' }],
        },
      },
    };
    const tasks: TaskItem[] = [{
      id: 'proactive-rel-sarah',
      source: 'proactive',
      status: 'suggestion',
      title: 'Check in with Sarah',
      createdAt: '2026-06-20T09:00:00.000Z',
      relationship: { name: 'Sarah', weeksSince: 4 },
    }];
    const pulse = buildProfilePulse({ kb, tasks, timeline: [], now });
    expect(pulse.some(p => p.kind === 'nudge')).toBe(true);
    expect(pulse.some(p => p.kind === 'sync' && p.title === 'Strava synced')).toBe(true);
  });

  it('formats last activity label', () => {
    const pulse = buildProfilePulse({
      kb: {},
      tasks: [{
        id: 'brief-latest',
        source: 'brief',
        status: 'done',
        title: 'Morning brief',
        createdAt: '2026-06-20T11:00:00.000Z',
        brief: {},
      }],
      timeline: [],
      now,
    });
    expect(profileLastActivityLabel(pulse, now)).toBe('1h');
  });
});
