import { describe, expect, it } from 'vitest';
import { canExecuteEmailAction, canSaveEmailDraft, normalizeEmailQueueAction } from './normalize-queue-action';
import type { QueuedAction } from './queue';

const base: QueuedAction = {
  id: '1',
  type: 'email_reply',
  summary: 'Reply to Genazzano: Acknowledge Ivy report',
  detail: 'Dear Genazzano Team,\nThank you.',
  agentRole: 'inbox-triage',
  tool: 'gmail_send',
  payload: {},
  status: 'pending',
  priority: 'normal',
  createdAt: new Date().toISOString(),
};

describe('normalizeEmailQueueAction', () => {
  it('copies detail into payload body', () => {
    const norm = normalizeEmailQueueAction(base);
    expect(norm.payload.body).toBe(base.detail);
    expect(norm.tool).toBe('gmail_send');
  });

  it('detects when send is possible', () => {
    expect(canExecuteEmailAction(base)).toBe(false);
    expect(canExecuteEmailAction({
      ...base,
      payload: { body: 'Hi', to: 'office@school.edu' },
    })).toBe(true);
  });

  it('detects when save is possible with body only', () => {
    expect(canSaveEmailDraft(base)).toBe(true);
    expect(canSaveEmailDraft({ ...base, detail: '', payload: {} })).toBe(false);
  });
});
