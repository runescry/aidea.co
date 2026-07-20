import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/agents/library', () => ({
  AGENT_LIBRARY: {
    'inbox-triage': {
      id: 'inbox-triage',
      displayName: 'Inbox Triage',
      authority: 'executor',
      defaultTools: ['gmail_read', 'queue_action'],
      stateWriteKey: 'inbox_triage',
      systemPrompt: 'Triage unread inbox and surface urgent items.',
    },
    'finance-director': {
      id: 'finance-director',
      displayName: 'Finance Director',
      authority: 'directive',
      defaultTools: ['write_state', 'read_state'],
      stateWriteKey: 'finance_output',
      systemPrompt: 'You are the Finance Director.',
    },
  },
}));

function get(headers?: Record<string, string>) {
  return GET(new Request('http://localhost/api/eval/agents', { headers }) as import('next/server').NextRequest);
}

describe('GET /api/eval/agents', () => {
  beforeEach(() => {
    delete process.env.EVAL_API_SECRET;
  });

  afterEach(() => vi.unstubAllEnvs());

  it('fails closed in production when EVAL_API_SECRET is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await get();
    expect(res.status).toBe(503);
  });

  it('returns agent catalog', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json() as { agents: Array<{ id: string; displayName: string; contractSummary: string }> };
    expect(body.agents.length).toBe(2);
    expect(body.agents[0]).toMatchObject({
      id: 'inbox-triage',
      displayName: 'Inbox Triage',
      stateWriteKey: 'inbox_triage',
    });
    expect(body.agents[0].contractSummary).toContain('Triage');
  });

  it('returns 401 when EVAL_API_SECRET is set and header missing', async () => {
    process.env.EVAL_API_SECRET = 'test-secret';
    const res = await get();
    expect(res.status).toBe(401);
  });
});
