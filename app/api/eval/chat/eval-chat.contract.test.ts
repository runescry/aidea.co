import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/ai/provider', () => ({
  hasApiKey: vi.fn(),
}));

vi.mock('@/lib/eval/collect-fast-chat', () => ({
  runFastChatToText: vi.fn(),
}));

import { hasApiKey } from '@/lib/ai/provider';
import { runFastChatToText } from '@/lib/eval/collect-fast-chat';

function post(body: unknown) {
  return POST(new Request('http://localhost/api/eval/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as import('next/server').NextRequest);
}

describe('POST /api/eval/chat', () => {
  beforeEach(() => {
    vi.mocked(hasApiKey).mockReset();
    vi.mocked(runFastChatToText).mockReset();
  });

  it('returns 400 when message is missing', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when message is empty', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    const res = await post({ message: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when no API key', async () => {
    vi.mocked(hasApiKey).mockReturnValue(false);
    const res = await post({ message: 'Hello' });
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('LLM not configured');
  });

  it('returns 200 with response and mode fast', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(runFastChatToText).mockResolvedValue('I can help with planning and advice.');
    const res = await post({ message: 'Hello' });
    expect(res.status).toBe(200);
    const body = await res.json() as { response: string; mode: string };
    expect(body.mode).toBe('fast');
    expect(body.response.length).toBeGreaterThan(0);
    expect(runFastChatToText).toHaveBeenCalledWith('Hello');
  });

  it('runs fast-chat for full-path prompts (model refuses in prose)', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(runFastChatToText).mockResolvedValue(
      'I cannot access your inbox in fast mode — repeat the request and I will run the full workflow.',
    );
    const res = await post({ message: "What's in my inbox?" });
    expect(res.status).toBe(200);
    const body = await res.json() as { response: string; mode: string };
    expect(body.mode).toBe('fast');
    expect(body.response).toContain('inbox');
    expect(runFastChatToText).toHaveBeenCalledWith("What's in my inbox?");
  });
});
