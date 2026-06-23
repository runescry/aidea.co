import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectFastChatResponse, runFastChatToText } from './collect-fast-chat';
import type { HarnessEvent } from '@/lib/harness/types';

const baseEvent = {
  sessionId: 's1',
  timestamp: '2026-06-01T00:00:00.000Z',
  data: {},
} satisfies Partial<HarnessEvent>;

vi.mock('@/lib/harness/fast-chat', () => ({
  runFastChat: vi.fn(),
}));

import { runFastChat } from '@/lib/harness/fast-chat';

describe('collectFastChatResponse', () => {
  it('prefers agent_complete summary over deltas', () => {
    const text = collectFastChatResponse([
      { ...baseEvent, type: 'agent_text_delta', data: { delta: 'partial' } },
      { ...baseEvent, type: 'agent_complete', data: { summary: 'Final answer' } },
    ] as HarnessEvent[]);
    expect(text).toBe('Final answer');
  });

  it('concatenates deltas when no summary', () => {
    const text = collectFastChatResponse([
      { ...baseEvent, type: 'agent_text_delta', data: { delta: 'Hello' } },
      { ...baseEvent, type: 'agent_text_delta', data: { delta: ' world' } },
    ] as HarnessEvent[]);
    expect(text).toBe('Hello world');
  });

  it('throws on error events', () => {
    expect(() => collectFastChatResponse([
      { ...baseEvent, type: 'error', data: { message: 'Model unavailable' } },
    ] as HarnessEvent[])).toThrow('Model unavailable');
  });
});

describe('runFastChatToText', () => {
  beforeEach(() => {
    vi.mocked(runFastChat).mockReset();
  });

  it('collects text from runFastChat events', async () => {
    vi.mocked(runFastChat).mockImplementation(async (_cmd, _hist, send) => {
      send({
        ...baseEvent,
        type: 'agent_text_delta',
        data: { delta: 'Hi' },
      } as HarnessEvent);
      send({
        ...baseEvent,
        type: 'agent_complete',
        data: { summary: 'Hi there' },
      } as HarnessEvent);
    });

    await expect(runFastChatToText('Hello')).resolves.toBe('Hi there');
    expect(runFastChat).toHaveBeenCalledWith('Hello', [], expect.any(Function), expect.any(String));
  });
});
