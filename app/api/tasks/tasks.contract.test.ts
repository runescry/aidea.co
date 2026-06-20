import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/tasks', () => {
  it('returns 200 with tasks array and needsYou count', async () => {
    const req = new NextRequest('http://localhost/api/tasks');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { tasks: unknown[]; needsYou: number };
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(typeof body.needsYou).toBe('number');
  });

  it('returns task items with required fields when queue is non-empty', async () => {
    const req = new NextRequest('http://localhost/api/tasks');
    const res = await GET(req);
    const body = await res.json() as { tasks: Array<Record<string, unknown>> };

    for (const task of body.tasks) {
      expect(task).toMatchObject({
        id: expect.any(String),
        source: expect.stringMatching(/^(queue|session|proactive)$/),
        status: expect.any(String),
        title: expect.any(String),
        createdAt: expect.any(String),
      });
    }
  });

  it('returns autonomy metadata when profile has preference', async () => {
    const req = new NextRequest('http://localhost/api/tasks');
    const res = await GET(req);
    const body = await res.json() as { autonomy: { label: string; hint: string } | null };
    expect(body.autonomy === null || typeof body.autonomy.label === 'string').toBe(true);
  });

  it('returns needsYou only when summary=1', async () => {
    const req = new NextRequest('http://localhost/api/tasks?summary=1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { needsYou?: number; tasks?: unknown[] };
    expect(typeof body.needsYou).toBe('number');
    expect(body.tasks).toBeUndefined();
  });
});
