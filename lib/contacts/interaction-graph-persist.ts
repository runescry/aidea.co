import type { KnowledgeBase } from '@/types/knowledge-base';
import { readAllKB, writeManyKB } from '@/lib/harness/knowledge-base';
import { buildContactGraph, contactKey, type ContactGraphEntry } from './interaction-graph';
import { findPersonByContact, isContactBlocked, upsertPerson } from '@/lib/profile/people';
import { ensurePeopleStore } from '@/lib/profile/people-migrate';

export async function recordContactInteraction(input: {
  name: string; email?: string; channel: string; summary?: string; relationship?: string; company?: string;
}): Promise<{ ok: true; entry: ContactGraphEntry } | { ok: false; blocked: true }> {
  let kb = ensurePeopleStore(await readAllKB() as KnowledgeBase);
  if (isContactBlocked(kb, input)) {
    return { ok: false, blocked: true };
  }

  const graph = buildContactGraph(kb);
  const at = new Date().toISOString();
  const key = contactKey(input.name, input.email);
  const matchedPerson = input.email ? findPersonByContact(kb, input.email) : undefined;
  const existing = matchedPerson
    ? graph.find(e => e.id === matchedPerson.id)
    : graph.find(e => contactKey(e.name, e.email) === key);
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
    status: 'active',
  };

  const source = input.channel === 'relationship-monitor' ? 'monitor' as const
    : input.channel === 'calendar' ? 'calendar' as const
    : input.channel === 'email' ? 'gmail' as const
    : 'manual' as const;

  const upserted = upsertPerson(kb, {
    id: matchedPerson?.id ?? existing?.id,
    name: entry.name,
    email: entry.email,
    emails: entry.email ? [entry.email] : undefined,
    company: entry.company,
    relationship: entry.relationship,
    status: 'active',
    sources: [source],
  });
  kb = upserted.kb;

  await writeManyKB({
    relationships: {
      ...(kb.relationships ?? {}),
      interactionGraph: {
        updatedAt: at,
        entries: [...graph.filter(e => contactKey(e.name, e.email) !== key), entry],
      },
    },
  });
  return { ok: true, entry };
}
