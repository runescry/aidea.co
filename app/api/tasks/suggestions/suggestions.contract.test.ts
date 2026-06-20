import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from './route';

describe('PATCH /api/tasks/suggestions', () => {
  it('returns 400 for non-proactive ids', async () => {
    const req = new NextRequest('http://localhost/api/tasks/suggestions', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'queue-1', action: 'dismiss' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('dismisses a proactive suggestion', async () => {
    const id = `proactive-test-${Date.now()}`;
    const req = new NextRequest('http://localhost/api/tasks/suggestions', {
      method: 'PATCH',
      body: JSON.stringify({ id, action: 'dismiss' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; id: string; action: string };
    expect(body.ok).toBe(true);
    expect(body.id).toBe(id);
    expect(body.action).toBe('dismiss');
  });

  it('snoozes a proactive suggestion', async () => {
    const id = `proactive-snooze-${Date.now()}`;
    const req = new NextRequest('http://localhost/api/tasks/suggestions', {
      method: 'PATCH',
      body: JSON.stringify({ id, action: 'snooze', days: 7 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; action: string };
    expect(body.ok).toBe(true);
    expect(body.action).toBe('snooze');
  });
});
