import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/queue/audit', () => {
  it('returns 200 with an array of audit entries', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);

    for (const entry of body) {
      expect(entry).toMatchObject({
        id: expect.any(String),
        actionId: expect.any(String),
        type: expect.any(String),
        summary: expect.any(String),
        agentRole: expect.any(String),
        status: expect.any(String),
        resolvedAt: expect.any(String),
      });
    }
  });
});
