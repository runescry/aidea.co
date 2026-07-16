import type { KnowledgeBase, MemoryHygiene } from '@/types/knowledge-base';
import type { ProfilePulseItem } from './pulse';

export function readMemoryHygiene(kb: KnowledgeBase) {
  return kb.preferences?.memoryHygiene ?? {};
}

export function dismissPulseId(kb: KnowledgeBase, pulseId: string): KnowledgeBase {
  const hygiene = readMemoryHygiene(kb);
  const dismissed = [...new Set([...(hygiene.dismissedPulseIds ?? []), pulseId])];
  return {
    ...kb,
    preferences: {
      ...(kb.preferences ?? {}),
      memoryHygiene: { ...hygiene, dismissedPulseIds: dismissed },
    },
  };
}

export function filterDismissedPulse(items: ProfilePulseItem[], kb: KnowledgeBase): ProfilePulseItem[] {
  const dismissed = new Set(readMemoryHygiene(kb).dismissedPulseIds ?? []);
  if (dismissed.size === 0) return items;
  return items.filter(item => !dismissed.has(item.id));
}

export type RejectedKbPatch = NonNullable<MemoryHygiene['rejectedKbPatches']>[number];

export function listRecentRejectedKbPatches(
  kb: KnowledgeBase,
  limit = 10,
): RejectedKbPatch[] {
  const patches = readMemoryHygiene(kb).rejectedKbPatches ?? [];
  if (limit <= 0) return [];
  return patches.slice(-limit);
}

export function formatRejectedKbPatchesForAgent(kb: KnowledgeBase): string {
  const patches = listRecentRejectedKbPatches(kb);
  if (patches.length === 0) return '';

  const lines = patches.map(p => {
    const role = p.agentRole ? ` (${p.agentRole})` : '';
    const date = p.at.slice(0, 10);
    return `- ${p.summary}${role} — rejected ${date}`;
  });

  return [
    'REJECTED PROFILE UPDATES (do not propose these again via update_kb unless the user explicitly asks):',
    ...lines,
  ].join('\n');
}

export function buildKbPatchRejectionUpdate(
  kb: KnowledgeBase,
  input: { summary: string; agentRole?: string },
): Pick<KnowledgeBase, 'preferences'> {
  const hygiene = readMemoryHygiene(kb);
  const rejected = [
    ...(hygiene.rejectedKbPatches ?? []),
    {
      at: new Date().toISOString(),
      summary: input.summary.trim() || 'Profile update rejected',
      ...(input.agentRole ? { agentRole: input.agentRole } : {}),
    },
  ].slice(-50);
  return {
    preferences: {
      ...(kb.preferences ?? {}),
      memoryHygiene: { ...hygiene, rejectedKbPatches: rejected },
    },
  };
}
