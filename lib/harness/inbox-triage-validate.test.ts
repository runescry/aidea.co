import { describe, expect, it } from 'vitest';
import { validateInboxTriageRun } from './inbox-triage-validate';
import type { HarnessEvent } from './types';

const baseEvents: HarnessEvent[] = [
  {
    type: 'entity_complete',
    sessionId: 's1',
    entityId: 'e1',
    data: {},
    timestamp: new Date().toISOString(),
  },
  {
    type: 'tool_called',
    sessionId: 's1',
    entityId: 'e1',
    agentId: 'a1',
    agentRole: 'inbox-triage',
    data: { tool: 'kb_read', input: {} },
    timestamp: new Date().toISOString(),
  },
  {
    type: 'tool_called',
    sessionId: 's1',
    entityId: 'e1',
    agentId: 'a1',
    agentRole: 'inbox-triage',
    data: { tool: 'gmail_read', input: { query: 'is:unread' } },
    timestamp: new Date().toISOString(),
  },
  {
    type: 'tool_called',
    sessionId: 's1',
    entityId: 'e1',
    agentId: 'a1',
    agentRole: 'inbox-triage',
    data: { tool: 'write_state', input: { key: 'inbox_triage' } },
    timestamp: new Date().toISOString(),
  },
];

describe('validateInboxTriageRun', () => {
  it('passes a well-formed triage result', () => {
    const stateData = {
      _gmailById: {
        'msg-1': {
          id: 'msg-1',
          from: 'Vercel <camden@vercel.com>',
          subject: 'Interview availability',
          snippet: 'Please share your availability.',
        },
      },
    };

    const result = validateInboxTriageRun(
      baseEvents,
      {
        urgent: [{
          messageId: 'msg-1',
          from: 'Vercel',
          subject: 'Interview availability',
          reason: 'Tracked application; needs reply',
          action: 'Confirm availability',
        }],
        actionRequired: [],
        fyi: [],
        draftsQueued: 1,
      },
      stateData,
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.stats.urgent).toBe(1);
    expect(result.stats.gmailEmails).toBe(1);
  });

  it('fails when messageId is not in gmail cache', () => {
    const result = validateInboxTriageRun(
      baseEvents,
      {
        urgent: [{ messageId: 'missing', reason: 'test', action: 'review' }],
      },
      { _gmailById: { 'msg-1': { id: 'msg-1', from: 'a', subject: 'b', snippet: 'c' } } },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('missing'))).toBe(true);
  });

  it('warns when attachments mentioned but tool not called', () => {
    const result = validateInboxTriageRun(
      baseEvents,
      {
        urgent: [{
          messageId: 'msg-1',
          subject: 'Settlement documents attached',
          snippet: 'Please review the attached PDF.',
          reason: 'Needs review',
          action: 'Open attachment',
        }],
      },
      {
        _gmailById: {
          'msg-1': {
            id: 'msg-1',
            from: 'Broker',
            subject: 'Settlement documents attached',
            snippet: 'Please review the attached PDF.',
          },
        },
      },
    );

    expect(result.warnings.some(w => w.includes('gmail_attachment_read'))).toBe(true);
  });

  it('fails when list limits are exceeded', () => {
    const urgent = Array.from({ length: 6 }, (_, i) => ({
      messageId: `msg-${i}`,
      reason: 'r',
      action: 'a',
    }));
    const gmailCache = Object.fromEntries(
      urgent.map((row, i) => [`msg-${i}`, { id: `msg-${i}`, from: 'x', subject: 'y', snippet: 'z' }]),
    );

    const result = validateInboxTriageRun(baseEvents, { urgent }, { _gmailById: gmailCache });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('urgent has 6'))).toBe(true);
  });
});
