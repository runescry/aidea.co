import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/agents', () => {
  it('returns 200 with groups and toolCatalog', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as {
      groups: Array<{ id: string; label: string; agents: unknown[] }>;
      toolCatalog: Record<string, unknown>;
    };

    expect(Array.isArray(body.groups)).toBe(true);
    expect(body.groups.length).toBeGreaterThan(0);
    expect(typeof body.toolCatalog).toBe('object');

    const commandGroup = body.groups.find(g => g.id === 'command');
    expect(commandGroup?.agents.length).toBeGreaterThan(0);

    const dispatcher = (commandGroup?.agents as Array<{ id: string }>).find(a => a.id === 'dispatcher');
    expect(dispatcher).toBeDefined();
  });
});
