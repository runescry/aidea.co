import { describe, it, expect } from 'vitest';
import {
  extractToolCallsFromEvents,
  toolsCalledFromEvents,
  responseTextFromEvents,
} from './harness-events';
import type { HarnessEvent } from '@/lib/harness/types';

describe('harness-events', () => {
  const events: HarnessEvent[] = [
    {
      type: 'tool_called',
      sessionId: 's',
      entityId: 'e',
      agentId: 'a',
      agentRole: 'inbox-triage',
      data: { tool: 'gmail_read', input: { query: 'is:unread', maxResults: 20 } },
      timestamp: '2026-01-01T00:00:00.000Z',
    },
    {
      type: 'agent_complete',
      sessionId: 's',
      entityId: 'e',
      agentId: 'a',
      agentRole: 'inbox-triage',
      data: { summary: 'Done.' },
      timestamp: '2026-01-01T00:00:01.000Z',
    },
    {
      type: 'agent_complete',
      sessionId: 's',
      entityId: 'e',
      agentId: 'a',
      agentRole: 'inbox-triage',
      data: { summary: 'Triage complete — 2 urgent.' },
      timestamp: '2026-01-01T00:00:02.000Z',
    },
  ];

  it('extracts tool calls from tool_called events', () => {
    expect(extractToolCallsFromEvents(events)).toEqual([
      { name: 'gmail_read', input: { query: 'is:unread', maxResults: 20 } },
    ]);
    expect(toolsCalledFromEvents(events)).toEqual(['gmail_read']);
  });

  it('prefers non-empty agent_complete summary over Done.', () => {
    const text = responseTextFromEvents(events, null, () => '');
    expect(text).toBe('Triage complete — 2 urgent.');
  });

  it('falls back to structured formatter', () => {
    const text = responseTextFromEvents(
      events.filter(e => e.type !== 'agent_complete'),
      { urgent: [{ subject: 'Hi' }] },
      v => `structured:${JSON.stringify(v)}`,
    );
    expect(text).toContain('structured:');
  });
});
