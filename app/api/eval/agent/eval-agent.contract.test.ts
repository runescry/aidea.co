import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/ai/provider', () => ({
  hasApiKey: vi.fn(),
}));

vi.mock('@/lib/eval/run-agent-harness', () => ({
  runAgentHarness: vi.fn(),
}));

import { hasApiKey } from '@/lib/ai/provider';
import { runAgentHarness } from '@/lib/eval/run-agent-harness';

function post(body: unknown, headers?: Record<string, string>) {
  return POST(new Request('http://localhost/api/eval/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as import('next/server').NextRequest);
}

describe('POST /api/eval/agent', () => {
  beforeEach(() => {
    vi.mocked(hasApiKey).mockReset();
    vi.mocked(runAgentHarness).mockReset();
    delete process.env.EVAL_ALLOW_LIVE;
    delete process.env.EVAL_API_SECRET;
  });

  it('returns 400 when agentId is missing', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    const res = await post({ mission: 'Do work' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when mission is missing', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    const res = await post({ agentId: 'inbox-triage' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when no API key', async () => {
    vi.mocked(hasApiKey).mockReturnValue(false);
    const res = await post({ agentId: 'inbox-triage', mission: 'Triage inbox' });
    expect(res.status).toBe(500);
  });

  it('rejects realWorldMode auto without EVAL_ALLOW_LIVE', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    const res = await post({
      agentId: 'inbox-triage',
      mission: 'Triage inbox',
      realWorldMode: 'auto',
    });
    expect(res.status).toBe(400);
    expect(runAgentHarness).not.toHaveBeenCalled();
  });

  it('returns 401 when EVAL_API_SECRET is set and header missing', async () => {
    process.env.EVAL_API_SECRET = 'test-secret';
    vi.mocked(hasApiKey).mockReturnValue(true);
    const res = await post({ agentId: 'inbox-triage', mission: 'Triage inbox' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with harness-json shape', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(runAgentHarness).mockResolvedValue({
      agentId: 'inbox-triage',
      mode: 'harness',
      realWorldMode: 'dry-run',
      response: 'Inbox triage complete.',
      structured: { urgent: [] },
      stateWriteKey: 'inbox_triage',
      toolsCalled: ['kb_read', 'gmail_read', 'write_state'],
      toolCalls: [{ name: 'gmail_read', input: { query: 'is:unread' } }],
      validation: { ok: true, errors: [], warnings: [] },
      cost: { estimatedUSD: 0.02, agentCount: 1 },
      sessionId: 'sess-1',
      state: {} as never,
      events: [],
    });

    const res = await post({
      agentId: 'inbox-triage',
      mission: 'Triage unread inbox',
      kbFixture: { identity: { name: 'Eval User' } },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.mode).toBe('harness');
    expect(body.response).toBe('Inbox triage complete.');
    expect(body.validation).toEqual({ ok: true, errors: [], warnings: [] });
    expect(runAgentHarness).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'inbox-triage',
      mission: 'Triage unread inbox',
      realWorldMode: 'dry-run',
      applyOverrides: false,
    }));
  });

  it('returns 400 for unknown agent from harness', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(runAgentHarness).mockRejectedValue(new Error('Unknown agentId: bogus'));
    const res = await post({ agentId: 'bogus', mission: 'Run' });
    expect(res.status).toBe(400);
  });
});
