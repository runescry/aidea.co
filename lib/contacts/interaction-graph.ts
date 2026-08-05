import type { KnowledgeBase } from '@/types/knowledge-base';
import { ensurePeopleStore } from '@/lib/profile/people-migrate';
import {
  contactKey,
  findPersonByContact,
  findPersonByName,
  isContactBlocked,
  normalizeEmail,
  personEmails,
  personKey,
  personPhones,
} from '@/lib/profile/people';

export interface ContactGraphEntry {
  id?: string;
  name: string;
  email?: string;
  emails?: string[];
  phones?: string[];
  relationship?: string;
  company?: string;
  lastTouch?: string;
  channels?: string[];
  status?: 'active' | 'archived';
  interactions?: Array<{ at: string; channel: string; summary?: string }>;
}

export type ContactInteraction = NonNullable<ContactGraphEntry['interactions']>[number];

export function recentContactInteractions(entry: ContactGraphEntry, limit = 8): ContactInteraction[] {
  const seen = new Set<string>();
  return [...(entry.interactions ?? [])]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .filter(item => {
      const key = `${item.at}|${item.channel}|${item.summary ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export { contactKey, personKey };

export function buildContactGraph(kb: KnowledgeBase): ContactGraphEntry[] {
  const normalized = ensurePeopleStore(kb);
  const byPersonId = new Map<string, ContactGraphEntry>();
  const byOrphanKey = new Map<string, ContactGraphEntry>();

  function mergeEntry(existing: ContactGraphEntry | undefined, incoming: ContactGraphEntry): ContactGraphEntry {
    const emails = [...new Set([...(existing?.emails ?? []), ...(incoming.emails ?? []), existing?.email, incoming.email].filter(Boolean).map(e => normalizeEmail(String(e))))];
    const phones = [...new Set([...(existing?.phones ?? []), ...(incoming.phones ?? [])])];
    return {
      ...existing,
      ...incoming,
      id: incoming.id ?? existing?.id,
      name: incoming.name || existing?.name || '',
      email: emails[0] ?? incoming.email ?? existing?.email,
      emails: emails.length > 0 ? emails : undefined,
      phones: phones.length > 0 ? phones : undefined,
      relationship: incoming.relationship ?? existing?.relationship,
      company: incoming.company ?? existing?.company,
      lastTouch: [existing?.lastTouch, incoming.lastTouch].filter(Boolean).sort().at(-1),
      channels: [...new Set([...(existing?.channels ?? []), ...(incoming.channels ?? [])])],
      interactions: [...(existing?.interactions ?? []), ...(incoming.interactions ?? [])].slice(-50),
      status: incoming.status ?? existing?.status ?? 'active',
    };
  }

  for (const entry of normalized.relationships?.interactionGraph?.entries ?? []) {
    if (!entry.name?.trim()) continue;
    if (isContactBlocked(normalized, { name: entry.name, email: entry.email })) continue;
    const person = entry.email
      ? findPersonByContact(normalized, entry.email) ?? findPersonByName(normalized, entry.name)
      : findPersonByName(normalized, entry.name);
    const graphEntry: ContactGraphEntry = {
      name: entry.name,
      email: entry.email,
      relationship: entry.relationship,
      company: entry.company,
      lastTouch: entry.lastTouch,
      channels: entry.channels,
      interactions: entry.interactions,
      id: person?.id,
      emails: entry.email ? [normalizeEmail(entry.email)] : undefined,
    };
    if (person?.id) {
      byPersonId.set(person.id, mergeEntry(byPersonId.get(person.id), graphEntry));
    } else {
      const key = contactKey(entry.name, entry.email);
      byOrphanKey.set(key, mergeEntry(byOrphanKey.get(key), graphEntry));
    }
  }

  for (const person of normalized.relationships?.people ?? []) {
    if (person.status === 'removed') continue;
    const emails = personEmails(person);
    const phones = personPhones(person);
    const base: ContactGraphEntry = {
      id: person.id,
      name: person.name,
      email: emails[0],
      emails: emails.length > 0 ? emails : undefined,
      phones: phones.length > 0 ? phones : undefined,
      relationship: person.relationship,
      company: person.company,
      channels: [],
      interactions: [],
      status: person.status === 'archived' ? 'archived' : 'active',
    };
    byPersonId.set(person.id, mergeEntry(byPersonId.get(person.id), base));
  }

  return [...byPersonId.values(), ...byOrphanKey.values()]
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
  return graph.find(e =>
    e.email?.toLowerCase() === q
    || e.emails?.some(email => email.toLowerCase() === q)
    || e.phones?.some(phone => phone.toLowerCase() === q.replace(/[^\d+]/g, '')),
  ) ?? graph.find(e => e.name.toLowerCase().includes(q));
}
