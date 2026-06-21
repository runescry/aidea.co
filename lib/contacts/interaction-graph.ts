import type { KnowledgeBase, PersonContact } from '@/types/knowledge-base';

export interface ContactGraphEntry {
  name: string;
  email?: string;
  relationship?: string;
  company?: string;
  lastTouch?: string;
  channels?: string[];
  interactions?: Array<{ at: string; channel: string; summary?: string }>;
}

function contactKey(entry: Pick<ContactGraphEntry, 'name' | 'email'>): string {
  return entry.email?.trim().toLowerCase() || entry.name.trim().toLowerCase();
}

function kbContacts(kb: KnowledgeBase): Array<PersonContact & { relationship?: string }> {
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
        contacts.push({ ...person, relationship: person.relationship ?? relationship });
      }
    }
  }
  for (const person of kb.work?.keyContacts ?? []) {
    if (!person.name?.trim()) continue;
    contacts.push({ ...person, relationship: person.relationship ?? 'contact' });
  }
  return contacts;
}

export function buildContactGraph(kb: KnowledgeBase): ContactGraphEntry[] {
  const byKey = new Map<string, ContactGraphEntry>();
  for (const entry of kb.relationships?.interactionGraph?.entries ?? []) {
    if (!entry.name?.trim()) continue;
    byKey.set(contactKey(entry), { ...entry });
  }
  for (const person of kbContacts(kb)) {
    const key = contactKey({ name: person.name!, email: person.email });
    const existing = byKey.get(key);
    byKey.set(key, existing ? {
      ...existing,
      relationship: existing.relationship ?? person.relationship,
      company: existing.company ?? person.company,
      email: existing.email ?? person.email,
    } : {
      name: person.name!, email: person.email, relationship: person.relationship,
      company: person.company, channels: [], interactions: [],
    });
  }
  return [...byKey.values()].sort((a, b) =>
    new Date(b.lastTouch ?? 0).getTime() - new Date(a.lastTouch ?? 0).getTime(),
  );
}

export function findContactEntry(graph: ContactGraphEntry[], query: string): ContactGraphEntry | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return graph.find(e => e.email?.toLowerCase() === q) ?? graph.find(e => e.name.toLowerCase().includes(q));
}
