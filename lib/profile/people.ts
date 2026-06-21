import type { KnowledgeBase, PersonContact, ProfilePerson, ProfilePersonSource, ProfilePersonStatus } from '@/types/knowledge-base';

export function contactKey(name: string, email?: string): string {
  const e = email?.trim().toLowerCase();
  if (e) return e;
  return name.trim().toLowerCase();
}

export function personKey(person: Pick<ProfilePerson, 'name' | 'email'>): string {
  return contactKey(person.name, person.email);
}

export function readRemovedKeys(kb: KnowledgeBase): Set<string> {
  const keys = kb.relationships?.removedKeys ?? [];
  return new Set(keys.filter((k): k is string => typeof k === 'string').map(k => k.toLowerCase()));
}

export function isContactBlocked(
  kb: KnowledgeBase,
  input: Pick<ProfilePerson, 'name' | 'email'>,
): boolean {
  const key = personKey(input);
  if (readRemovedKeys(kb).has(key)) return true;
  const people = kb.relationships?.people ?? [];
  const match = people.find(p => personKey(p) === key);
  return match?.status === 'removed';
}

export function listPeople(kb: KnowledgeBase, status?: ProfilePersonStatus | 'visible'): ProfilePerson[] {
  const people = kb.relationships?.people ?? [];
  if (!status || status === 'visible') {
    return people.filter(p => p.status === 'active' || p.status === 'archived');
  }
  return people.filter(p => p.status === status);
}

export function listActivePeople(kb: KnowledgeBase): ProfilePerson[] {
  return listPeople(kb, 'active');
}

export function findPersonById(kb: KnowledgeBase, id: string): ProfilePerson | undefined {
  return kb.relationships?.people?.find(p => p.id === id);
}

export function findPersonByKey(kb: KnowledgeBase, key: string): ProfilePerson | undefined {
  const normalized = key.toLowerCase();
  return kb.relationships?.people?.find(p => personKey(p) === normalized);
}

export function upsertPerson(
  kb: KnowledgeBase,
  patch: Omit<ProfilePerson, 'id' | 'status'> & {
    id?: string;
    status?: ProfilePersonStatus;
    sources?: ProfilePersonSource[];
  },
): { kb: KnowledgeBase; person: ProfilePerson } {
  const relationships = { ...(kb.relationships ?? {}) };
  const people = [...(relationships.people ?? [])];
  const key = personKey({ name: patch.name, email: patch.email });
  const idx = patch.id
    ? people.findIndex(p => p.id === patch.id)
    : people.findIndex(p => personKey(p) === key);

  const existing = idx >= 0 ? people[idx] : undefined;
  const status = patch.status ?? existing?.status ?? 'active';
  const person: ProfilePerson = {
    id: existing?.id ?? patch.id ?? crypto.randomUUID(),
    name: patch.name.trim(),
    email: patch.email?.trim() || undefined,
    company: patch.company?.trim() || existing?.company,
    relationship: patch.relationship?.trim() || existing?.relationship,
    notes: patch.notes ?? existing?.notes,
    status,
    removedAt: status === 'removed' ? (existing?.removedAt ?? new Date().toISOString()) : undefined,
    sources: [...new Set([...(existing?.sources ?? []), ...(patch.sources ?? ['manual'])])],
  };

  if (idx >= 0) people[idx] = person;
  else people.push(person);

  let removedKeys = [...(relationships.removedKeys ?? [])];
  if (status === 'removed') {
    const rk = personKey(person);
    if (!removedKeys.map(k => k.toLowerCase()).includes(rk)) {
      removedKeys = [...removedKeys, rk];
    }
  } else {
    removedKeys = removedKeys.filter(k => k.toLowerCase() !== personKey(person));
  }

  const nextKb: KnowledgeBase = {
    ...kb,
    relationships: { ...relationships, people, removedKeys },
  };
  return { kb: nextKb, person };
}

export function setPersonStatus(
  kb: KnowledgeBase,
  id: string,
  status: ProfilePersonStatus,
): { kb: KnowledgeBase; person: ProfilePerson | null } {
  const person = findPersonById(kb, id);
  if (!person) return { kb, person: null };
  return upsertPerson(kb, { ...person, status });
}

export function removePerson(kb: KnowledgeBase, id: string): { kb: KnowledgeBase; person: ProfilePerson | null } {
  return setPersonStatus(kb, id, 'removed');
}

export function restorePerson(kb: KnowledgeBase, id: string): { kb: KnowledgeBase; person: ProfilePerson | null } {
  return setPersonStatus(kb, id, 'active');
}

export function archivePerson(kb: KnowledgeBase, id: string): { kb: KnowledgeBase; person: ProfilePerson | null } {
  return setPersonStatus(kb, id, 'archived');
}

export function peopleContactsForEditor(kb: KnowledgeBase, relationship: string): PersonContact[] {
  const rel = relationship.toLowerCase();
  return listPeople(kb, 'active')
    .filter(p => (p.relationship ?? '').toLowerCase() === rel)
    .map(p => ({
      name: p.name,
      email: p.email,
      company: p.company,
      relationship: p.relationship,
      notes: p.notes,
    }));
}

/** Upsert onboarding/profile list edits into canonical relationships.people. */
export function applyContactListToPeople(
  kb: KnowledgeBase,
  contacts: PersonContact[],
  relationship: string,
  source: ProfilePersonSource = 'manual',
): KnowledgeBase {
  let next = kb;
  for (const contact of contacts) {
    if (!contact.name?.trim()) continue;
    const result = upsertPerson(next, {
      name: contact.name.trim(),
      email: contact.email?.trim() || undefined,
      company: contact.company?.trim() || undefined,
      relationship: contact.relationship?.trim() || relationship,
      notes: contact.notes,
      sources: [source],
    });
    next = result.kb;
  }
  return next;
}

export function activePeopleCount(kb: KnowledgeBase): number {
  return listPeople(kb, 'active').length;
}
