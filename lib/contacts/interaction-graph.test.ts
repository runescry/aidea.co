import { describe, expect, it } from 'vitest';
import { buildContactGraph, findContactEntry } from './interaction-graph';

describe('buildContactGraph', () => {
  it('merges graph entries with KB contacts', () => {
    const graph = buildContactGraph({
      relationships: {
        mentors: [{ name: 'Sarah', email: 's@x.com' }],
        interactionGraph: { entries: [{ name: 'Sarah', email: 's@x.com', channels: ['email'], interactions: [] }] },
      },
    });
    expect(graph[0].relationship).toBe('mentor');
  });
});

describe('findContactEntry', () => {
  it('finds by email', () => {
    const graph = buildContactGraph({ relationships: { friends: [{ name: 'Emma', email: 'e@x.com' }] } });
    expect(findContactEntry(graph, 'e@x.com')?.name).toBe('Emma');
  });
});
