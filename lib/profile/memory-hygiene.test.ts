import { describe, expect, it } from 'vitest';
import type { KnowledgeBase } from '@/types/knowledge-base';
import {
  buildKbPatchRejectionUpdate,
  dismissPulseId,
  filterDismissedPulse,
  formatRejectedKbPatchesForAgent,
  listRecentRejectedKbPatches,
  readMemoryHygiene,
} from './memory-hygiene';

describe('memory hygiene', () => {
  it('dismisses pulse ids', () => {
    const kb: KnowledgeBase = {};
    const next = dismissPulseId(kb, 'pulse-1');
    expect(readMemoryHygiene(next).dismissedPulseIds).toEqual(['pulse-1']);
  });

  it('filters dismissed pulse items', () => {
    const kb: KnowledgeBase = { preferences: { memoryHygiene: { dismissedPulseIds: ['a'] } } };
    const items = filterDismissedPulse([
      { id: 'a', kind: 'change', at: '2026-06-01', title: 'Hidden' },
      { id: 'b', kind: 'change', at: '2026-06-01', title: 'Visible' },
    ], kb);
    expect(items.map(i => i.id)).toEqual(['b']);
  });

  it('records rejected kb patches', () => {
    const kb: KnowledgeBase = {};
    const patch = buildKbPatchRejectionUpdate(kb, { summary: 'Add mentor Bob', agentRole: 'dispatcher' });
    expect(patch.preferences?.memoryHygiene?.rejectedKbPatches?.[0]).toMatchObject({
      summary: 'Add mentor Bob',
      agentRole: 'dispatcher',
    });
  });

  it('lists recent rejected kb patches with limit', () => {
    const kb: KnowledgeBase = {
      preferences: {
        memoryHygiene: {
          rejectedKbPatches: [
            { at: '2026-06-01T10:00:00.000Z', summary: 'First' },
            { at: '2026-06-02T10:00:00.000Z', summary: 'Second' },
            { at: '2026-06-03T10:00:00.000Z', summary: 'Third' },
          ],
        },
      },
    };
    expect(listRecentRejectedKbPatches(kb, 2).map(p => p.summary)).toEqual(['Second', 'Third']);
  });

  it('formats rejected kb patches for agent prompts', () => {
    const kb: KnowledgeBase = {
      preferences: {
        memoryHygiene: {
          rejectedKbPatches: [
            { at: '2026-06-03T10:00:00.000Z', summary: 'Add mentor Bob', agentRole: 'dispatcher' },
          ],
        },
      },
    };
    const formatted = formatRejectedKbPatchesForAgent(kb);
    expect(formatted).toContain('REJECTED PROFILE UPDATES');
    expect(formatted).toContain('Add mentor Bob (dispatcher)');
    expect(formatted).toContain('rejected 2026-06-03');
  });

  it('returns empty string when no rejected kb patches', () => {
    expect(formatRejectedKbPatchesForAgent({})).toBe('');
  });
});
