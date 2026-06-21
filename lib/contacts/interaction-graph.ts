import type { KnowledgeBase } from '@/types/knowledge-base';
import { ensurePeopleStore } from '@/lib/profile/people-migrate';
import {
  contactKey,
  isContactBlocked,
  personKey,
} from '@/lib/profile/people';
import type { PersonContact } from '@/types/knowledge-base';

export interface ContactGraphEntry {
  id?: string;
  name: string;
  email?: string;
  relationship?: string;
  company?: string;
  lastTouch?: string;
  channels?: string[];
  status?: 'active' | 'archived';
  interactions?: Array<{ at: string; channel: string; summary?: string }>;
}

export { contactKey, personKey };

function kbLegacyContacts(kb: KnowledgeBase): Array<PersonContact & { relationship?: string }> {
  const contacts: Array<PersonContact & { relationship?: string }> = [];
  const rel = kb.relationships;
  if (rel) {
    const groups: Array<[PersonContact[] | undefined, string]> = [
      [rel.mentors, 'mentor'], [rel.collaborators, 'collaborator'],
      [rel.innerCircle, 'inner circle'], [rel.friends, 'friend'],
    ];
    for (const [list, relationship] of groups) {
      for (const person of list ?? []) {
        if (!person.name?.trim()) continue;
        if (isContactBlocked(kb, { name: person.name, email: person.email })) continue;
        contacts.push({ ...person, relationship: person.relationship ?? relationship });
      }
    }
  }
  for (const person of kb.work?.keyContacts ?? []) {
    if (!person.name?.trim()) continue;
    if (isContactBlocked(kb, { name: person.name, email: person.email })) continue;
    contacts.push({ ...person, relationship: person.relationship ?? 'contact' });
  }
  return contacts;
}

export function buildContactGraph(kb: KnowledgeBase): ContactGraphEntry[] {
  const normalized = ensurePeopleStore(kb);
  const byKey = new Map<string, ContactGraphEntry>();

  for (const entry of normalized.relationships?.interactionGraph?.entries ?? []) {
    if (!entry.name?.trim()) continue;
    if (isContactBlocked(normalized, { name: entry.name, email: entry.email })) continue;
    byKey.set(contactKey(entry.name, entry.email), { ...entry });
  }

  const canonical = normalized.relationships?.people ?? [];
  if (canonical.length > 0) {
    for (const person of canonical) {
      if (person.status === 'removed') continue;
      const key = personKey(person);
      const existing = byKey.get(key);
      byKey.set(key, {
        id: person.id,
        name: person.name,
        email: person.email,
        relationship: person.relationship ?? existing?.relationship,
        company: person.company ?? existing?.company,
        lastTouch: existing?.lastTouch,
        channels: existing?.channels ?? [],
        interactions: existing?.interactions ?? [],
        status: person.status === 'archived' ? 'archived' : 'active',
      });
    }
  } else {
    for (const person of kbLegacyContacts(normalized)) {
      const key = contactKey(person.name!, person.email);
      const existing = byKey.get(key);
      byKey.set(key, existing ? {
        ...existing,
        relationship: existing.relationship ?? person.relationship,
        company: existing.company ?? person.company,
        email: existing.email ?? person.email,
      } : {
        name: person.name!, email: person.email, relationship: person.relationship,
        company: person.company, channels: [], interactions: [], status: 'active',
      });
    }
  }

  return [...byKey.values()]
    .sort((a, b) =>
      new Date(b.lastTouch ?? 0).getTime() - new Date(a.lastTouch ?? 0).getTime(),
    );
}

export function buildVisibleContactGraph(kb: KnowledgeBase): ContactGraphEntry[] {
  return buildContactGraph(kb).filter(e => e.status !== 'archived');
}

export function findContactEntry(graph: ContactGraphEntry[], query: string): ContactGraphEntry | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return graph.find(e => e.email?.toLowerCase() === q) ?? graph.find(e => e.name.toLowerCase().includes(q));
}
