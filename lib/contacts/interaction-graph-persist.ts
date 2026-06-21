import type { KnowledgeBase } from '@/types/knowledge-base';
import { readAllKB, writeManyKB } from '@/lib/harness/knowledge-base';
import { buildContactGraph, type ContactGraphEntry } from './interaction-graph';

function contactKey(entry: Pick<ContactGraphEntry, 'name' | 'email'>): string {
  return entry.email?.trim().toLowerCase() || entry.name.trim().toLowerCase();
}

export async function recordContactInteraction(input: {
  name: string; email?: string; channel: string; summary?: string; relationship?: string; company?: string;
}): Promise<{ ok: true; entry: ContactGraphEntry }> {
  const kb = await readAllKB() as KnowledgeBase;
  const graph = buildContactGraph(kb);
  const at = new Date().toISOString();
  const key = contactKey(input);
  const existing = graph.find(e => contactKey(e) === key);
  const interaction = { at, channel: input.channel, summary: input.summary };
  const entry: ContactGraphEntry = existing ? {
    ...existing,
    name: input.name.trim() || existing.name,
    email: input.email ?? existing.email,
    relationship: input.relationship ?? existing.relationship,
    company: input.company ?? existing.company,
    lastTouch: at,
    channels: [...new Set([...(existing.channels ?? []), input.channel])],
    interactions: [...(existing.interactions ?? []), interaction].slice(-50),
  } : {
    name: input.name.trim(), email: input.email, relationship: input.relationship,
    company: input.company, lastTouch: at, channels: [input.channel], interactions: [interaction],
  };
  await writeManyKB({
    relationships: {
      ...(kb.relationships ?? {}),
      interactionGraph: { updatedAt: at, entries: [...graph.filter(e => contactKey(e) !== key), entry] },
    },
  });
  return { ok: true, entry };
}
