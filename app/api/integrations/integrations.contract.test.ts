import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/integrations', () => {
  it('returns integration list and missingCount', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as {
      integrations: Array<{ id: string; label: string; configured: boolean }>;
      missingCount: number;
    };
    expect(Array.isArray(body.integrations)).toBe(true);
    expect(body.integrations.length).toBe(6);
    expect(body.integrations.some(i => i.id === 'googleCalendar')).toBe(true);
    expect(body.integrations.some(i => i.id === 'microsoft')).toBe(true);
    expect(typeof body.missingCount).toBe('number');
  });
});
