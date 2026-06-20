import { describe, expect, it } from 'vitest';
import { canExecuteEmailAction, canSaveEmailDraft, normalizeEmailQueueAction, normalizeCalendarQueueAction, applyQueueEdits } from './normalize-queue-action';
import type { QueuedAction } from './queue-types';

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

describe('applyQueueEdits', () => {
  it('updates body and detail for email drafts', () => {
    const edited = applyQueueEdits(base, { body: 'Updated draft text.' });
    expect(edited.detail).toBe('Updated draft text.');
    expect(edited.payload.body).toBe('Updated draft text.');
  });

  it('updates subject without changing body when only subject is edited', () => {
    const withSubject = {
      ...base,
      payload: { ...base.payload, subject: 'Re: Acknowledge Ivy report' },
    };
    const edited = applyQueueEdits(withSubject, { subject: 'Re: Updated subject' });
    expect(edited.payload.subject).toBe('Re: Updated subject');
    expect(edited.detail).toBe(base.detail);
  });

  it('updates to and cc recipients', () => {
    const withRecipients = {
      ...base,
      payload: { ...base.payload, to: 'old@example.com', cc: 'cc@example.com' },
    };
    const edited = applyQueueEdits(withRecipients, {
      to: 'new@example.com',
      cc: 'other@example.com, third@example.com',
    });
    expect(edited.payload.to).toBe('new@example.com');
    expect(edited.payload.cc).toBe('other@example.com, third@example.com');
  });

  it('clears cc when edit is empty', () => {
    const withCc = {
      ...base,
      payload: { ...base.payload, to: 'a@b.com', cc: 'cc@example.com' },
    };
    const edited = applyQueueEdits(withCc, { cc: '' });
    expect(edited.payload.cc).toBeUndefined();
    expect(edited.payload.to).toBe('a@b.com');
  });

  it('ignores edits for non-email actions without calendar fields', () => {
    const kbAction = { ...base, type: 'kb_update' as const };
    expect(applyQueueEdits(kbAction, { body: 'Nope' })).toEqual(kbAction);
  });
});

describe('normalizeCalendarQueueAction', () => {
  const calBase: QueuedAction = {
    ...base,
    type: 'calendar_event',
    summary: 'Calendar: Team sync at 2026-06-01T14:00:00.000Z',
    tool: 'calendar_create',
    payload: {
      title: 'Team sync',
      start: '2026-06-01T14:00:00.000Z',
      durationMinutes: 30,
    },
  };

  it('preserves calendar payload fields', () => {
    const norm = normalizeCalendarQueueAction(calBase);
    expect(norm.payload.title).toBe('Team sync');
    expect(norm.tool).toBe('calendar_create');
  });
});
