import { describe, it, expect } from 'vitest';
import { queueDedupeKey } from './queue';
import type { QueuedAction } from './queue-types';

function action(partial: Partial<QueuedAction> & Pick<QueuedAction, 'type' | 'summary'>): QueuedAction {
  return {
    id: 'q1',
    status: 'pending',
    createdAt: '2026-06-01T00:00:00.000Z',
    agentRole: 'inbox-triage',
    tool: 'queue_action',
    payload: {},
    priority: 'normal',
    ...partial,
  };
}

describe('queueDedupeKey', () => {
  it('dedupes email replies by message id', () => {
    const a = action({
      type: 'email_reply',
      summary: 'Reply to Sarah',
      payload: { replyToMessageId: 'msg-123', to: 's@x.com' },
    });
    const b = action({
      type: 'email_reply',
      summary: 'Different summary',
      payload: { replyToMessageId: 'msg-123', to: 's@x.com' },
    });
    expect(queueDedupeKey(a)).toBe(queueDedupeKey(b));
  });

  it('dedupes kb_update by job company', () => {
    const a = action({
      type: 'kb_update',
      summary: 'Vercel status',
      payload: { input: { jobApplication: { company: 'Vercel', status: 'Interviewing' } } },
    });
    const b = action({
      type: 'kb_update',
      summary: 'Vercel update again',
      payload: { input: { jobApplication: { company: 'Vercel', status: 'Offer' } } },
    });
    expect(queueDedupeKey(a)).toBe(queueDedupeKey(b));
  });

  it('dedupes email replies by thread id when present', () => {
    const a = action({
      type: 'email_reply',
      summary: 'Reply A',
      payload: { threadId: 'thread-1', replyToMessageId: 'msg-old' },
    });
    const b = action({
      type: 'email_reply',
      summary: 'Reply B',
      payload: { threadId: 'thread-1', replyToMessageId: 'msg-new' },
    });
    expect(queueDedupeKey(a)).toBe(queueDedupeKey(b));
  });
});
