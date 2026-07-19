import { describe, expect, it } from 'vitest';
import { buildContactGraph, findContactEntry, recentContactInteractions } from './interaction-graph';

describe('buildContactGraph', () => {
  it('excludes removed contacts from graph', () => {
    const graph = buildContactGraph({
      relationships: {
        people: [
          { id: '1', name: 'Sarah', email: 's@x.com', status: 'active' },
          { id: '2', name: 'Ghost', email: 'g@x.com', status: 'removed', removedAt: '2026-06-01' },
        ],
        removedKeys: ['g@x.com'],
      },
    });
    expect(graph.map(e => e.email)).toEqual(['s@x.com']);
  });

  it('uses canonical people store when present', () => {
    const graph = buildContactGraph({
      relationships: {
        mentors: [{ name: 'Sarah', email: 's@x.com' }],
        interactionGraph: { entries: [{ name: 'Sarah', email: 's@x.com', channels: ['email'], interactions: [] }] },
      },
    });
    expect(graph[0].relationship).toBe('mentor');
  });
});

describe('recentContactInteractions', () => {
  it('returns newest unique interactions first and respects the limit', () => {
    const duplicate = { at: '2026-07-18T10:00:00Z', channel: 'email', summary: 'Budget reply' };
    const result = recentContactInteractions({
      name: 'Sarah',
      interactions: [
        { at: '2026-07-17T10:00:00Z', channel: 'calendar', summary: 'Planning meeting' },
        duplicate,
        duplicate,
        { at: '2026-07-19T10:00:00Z', channel: 'email', summary: 'Follow-up' },
      ],
    }, 2);

    expect(result).toEqual([
      { at: '2026-07-19T10:00:00Z', channel: 'email', summary: 'Follow-up' },
      duplicate,
    ]);
  });
});

describe('findContactEntry', () => {
  it('finds by email', () => {
    const graph = buildContactGraph({ relationships: { friends: [{ name: 'Emma', email: 'e@x.com' }] } });
    expect(findContactEntry(graph, 'e@x.com')?.name).toBe('Emma');
  });

  it('finds by secondary email alias', () => {
    const graph = buildContactGraph({
      relationships: {
        people: [{
          id: 'p1',
          name: 'Sarah',
          email: 's@work.com',
          emails: ['s@work.com', 's@gmail.com'],
          status: 'active',
        }],
      },
    });
    expect(findContactEntry(graph, 's@gmail.com')?.name).toBe('Sarah');
  });
});
