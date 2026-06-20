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

  it('returns timeline and domain autonomy', async () => {
    const res = await GET(new NextRequest('http://localhost/api/tasks'));
    const body = await res.json() as {
      timeline: unknown[];
      autonomy: { label: string; domains: unknown[] };
    };
    expect(Array.isArray(body.timeline)).toBe(true);
    expect(Array.isArray(body.autonomy.domains)).toBe(true);
  });

  it('returns needsYou only when summary=1', async () => {
    const res = await GET(new NextRequest('http://localhost/api/tasks?summary=1'));
    const body = await res.json() as { needsYou: number; tasks?: unknown[] };
    expect(typeof body.needsYou).toBe('number');
    expect(body.tasks).toBeUndefined();
  });
});
