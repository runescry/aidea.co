import { describe, expect, it } from 'vitest';
import { slimQueuedActionForFeed } from './queue-feed';
import type { QueuedAction } from './queue-types';

const base: QueuedAction = {
  id: '1',
  type: 'kb_update',
  summary: 'Vercel → interview scheduling',
  agentRole: 'inbox-triage',
  tool: 'update_kb',
  payload: {},
  status: 'pending',
  priority: 'normal',
  createdAt: new Date().toISOString(),
};

describe('slimQueuedActionForFeed', () => {
  it('strips bloated patch.work when input is present', () => {
    const action: QueuedAction = {
      ...base,
      payload: {
        input: { jobApplication: { company: 'Vercel', status: 'Interviewing' } },
        patch: { work: { role: 'Founder', currentProjects: { jobApplications: [] } } },
        reason: 'Cassidy requesting times',
      },
    };

    const slim = slimQueuedActionForFeed(action);
    expect(slim.payload.input).toBeDefined();
    expect(slim.payload.patch).toBeUndefined();
    expect(slim.payload.reason).toBe('Cassidy requesting times');
  });

  it('keeps dot-key patches', () => {
    const action: QueuedAction = {
      ...base,
      payload: {
        input: { key: 'family.children[1].notes', value: 'Updated' },
        patch: { _dotKey: 'family.children[1].notes', _dotValue: 'Updated' },
      },
    };

    const slim = slimQueuedActionForFeed(action);
    expect(slim.payload.patch).toMatchObject({ _dotKey: 'family.children[1].notes' });
  });

  it('does not modify email actions', () => {
    const action: QueuedAction = {
      ...base,
      type: 'email_reply',
      payload: { to: 'a@b.com', subject: 'Hi', body: 'Hello' },
    };
    expect(slimQueuedActionForFeed(action)).toEqual(action);
  });
});
