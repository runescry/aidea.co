import { describe, it, expect, vi } from 'vitest';
import { emitChatAgentResponse } from './chat-events';
import type { HarnessAgent, HarnessContext } from './types';

function mockCtx(send = vi.fn()): HarnessContext {
  return {
    entityId: 'e1',
    sessionId: 's1',
    send,
  } as unknown as HarnessContext;
}

const agent = {
  id: 'a1',
  role: 'dispatcher',
  stateWriteKey: 'dispatch_response',
} as HarnessAgent;

describe('emitChatAgentResponse', () => {
  it('emits agent_response when writing the agent output key', () => {
    const send = vi.fn();
    emitChatAgentResponse(mockCtx(send), agent, 'dispatch_response', {
      summary: 'Three emails need attention.',
      inbox_summary: [],
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].type).toBe('agent_response');
    expect(send.mock.calls[0][0].data.summary).toBe('Three emails need attention.');
  });

  it('ignores unrelated state keys', () => {
    const send = vi.fn();
    emitChatAgentResponse(mockCtx(send), agent, 'other_key', { summary: 'nope' });
    expect(send).not.toHaveBeenCalled();
  });
});
