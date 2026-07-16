import { describe, expect, it } from 'vitest';
import { classifyAgentWait, isTerminalAgentStatus } from './agent-wait';

describe('isTerminalAgentStatus', () => {
  it('treats complete and error as terminal', () => {
    expect(isTerminalAgentStatus('complete')).toBe(true);
    expect(isTerminalAgentStatus('error')).toBe(true);
  });

  it('treats running and idle as non-terminal', () => {
    expect(isTerminalAgentStatus('running')).toBe(false);
    expect(isTerminalAgentStatus('idle')).toBe(false);
    expect(isTerminalAgentStatus(undefined)).toBe(false);
  });
});

describe('classifyAgentWait', () => {
  it('waits until all roles are complete or error', () => {
    const statuses: Record<string, string> = {
      'inbox-triage': 'complete',
      'news-curator': 'running',
    };
    const mid = classifyAgentWait(['inbox-triage', 'news-curator'], r => statuses[r]);
    expect(mid.allTerminal).toBe(false);
    expect(mid.pending).toEqual(['news-curator']);

    statuses['news-curator'] = 'error';
    const done = classifyAgentWait(['inbox-triage', 'news-curator'], r => statuses[r]);
    expect(done.allTerminal).toBe(true);
    expect(done.failed).toEqual(['news-curator']);
    expect(done.pending).toEqual([]);
  });
});
