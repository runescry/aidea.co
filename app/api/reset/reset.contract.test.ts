import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('POST /api/reset', () => {
  it('returns 200 with ok: true', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
