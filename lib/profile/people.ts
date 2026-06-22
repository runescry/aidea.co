import type { KnowledgeBase, PersonContact, ProfilePerson, ProfilePersonSource, ProfilePersonStatus } from '@/types/knowledge-base';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d+]/g, '');
  return digits || trimmed;
}

export function contactKey(name: string, email?: string): string {
  const e = email?.trim().toLowerCase();
  if (e) return e;
  return name.trim().toLowerCase();
}

export function personKey(person: Pick<ProfilePerson, 'name' | 'email'>): string {
  return contactKey(person.name, person.email);
}

export function personEmails(person: Pick<ProfilePerson, 'email' | 'emails'>): string[] {
  const out = new Set<string>();
  if (person.email?.trim()) out.add(normalizeEmail(person.email));
  for (const email of person.emails ?? []) {
    if (email?.trim()) out.add(normalizeEmail(email));
  }
  return [...out];
}

export function personPhones(person: Pick<ProfilePerson, 'phones'>): string[] {
  const out = new Set<string>();
  for (const phone of person.phones ?? []) {
    if (phone?.trim()) out.add(normalizePhone(phone));
  }
  return [...out];
}

export function personContactKeys(person: ProfilePerson): string[] {
  return [...personEmails(person), ...personPhones(person)];
}

function syncPrimaryEmail(person: Pick<ProfilePerson, 'email' | 'emails'>): Pick<ProfilePerson, 'email' | 'emails'> {
  const emails = personEmails(person);
  if (emails.length === 0) return { email: undefined, emails: undefined };
  return { email: person.email?.trim() ? normalizeEmail(person.email) : emails[0], emails };
}

export function readRemovedKeys(kb: KnowledgeBase): Set<string> {
  const keys = kb.relationships?.removedKeys ?? [];
  return new Set(keys.filter((k): k is string => typeof k === 'string').map(k => k.toLowerCase()));
}

export function isContactBlocked(
  kb: KnowledgeBase,
  input: Pick<ProfilePerson, 'name' | 'email' | 'emails' | 'phones'>,
): boolean {
  const keys = [
    personKey(input),
    ...personEmails(input),
    ...personPhones(input),
  ].map(k => k.toLowerCase());
  const removed = readRemovedKeys(kb);
  if (keys.some(k => removed.has(k))) return true;

  const people = kb.relationships?.people ?? [];
  for (const person of people) {
    if (person.status !== 'removed') continue;
    const personKeys = personContactKeys(person).map(k => k.toLowerCase());
    if (keys.some(k => personKeys.includes(k))) return true;
    if (personKey(person) === personKey(input)) return true;
  }
  return false;
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
  return kb.relationships?.people?.find(p =>
    personKey(p) === normalized || personContactKeys(p).some(k => k.toLowerCase() === normalized),
  );
}

export function findPersonByContact(kb: KnowledgeBase, value: string): ProfilePerson | undefined {
  const normalized = value.includes('@') ? normalizeEmail(value) : normalizePhone(value);
  return kb.relationships?.people?.find(p =>
    personContactKeys(p).some(k => k.toLowerCase() === normalized),
  );
}

export function findPersonByName(kb: KnowledgeBase, name: string): ProfilePerson | undefined {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  return listPeople(kb, 'visible').find(p => p.name.trim().toLowerCase() === normalized);
}

/** Active canonical people — use for merge targets (always have ids). */
export function listMergeTargets(kb: KnowledgeBase): ProfilePerson[] {
  return listActivePeople(kb).sort((a, b) => a.name.localeCompare(b.name));
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
  const synced = syncPrimaryEmail(patch);
  const key = personKey({ name: patch.name, email: synced.email });
  const idx = patch.id
    ? people.findIndex(p => p.id === patch.id)
    : people.findIndex(p =>
        personKey(p) === key
        || (synced.email ? personEmails(p).includes(synced.email) : false),
      );

  const existing = idx >= 0 ? people[idx] : undefined;
  const status = patch.status ?? existing?.status ?? 'active';
  const mergedEmails = [...new Set([...personEmails(existing ?? {}), ...personEmails({ ...patch, ...synced })])];
  const mergedPhones = [...new Set([...personPhones(existing ?? {}), ...personPhones(patch)])];
  const person: ProfilePerson = {
    id: existing?.id ?? patch.id ?? crypto.randomUUID(),
    name: patch.name.trim(),
    email: mergedEmails[0],
    emails: mergedEmails.length > 0 ? mergedEmails : undefined,
    phones: mergedPhones.length > 0 ? mergedPhones : undefined,
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
    for (const rk of personContactKeys(person)) {
      if (!removedKeys.map(k => k.toLowerCase()).includes(rk.toLowerCase())) {
        removedKeys = [...removedKeys, rk];
      }
    }
  } else {
    const block = new Set(personContactKeys(person).map(k => k.toLowerCase()));
    removedKeys = removedKeys.filter(k => !block.has(k.toLowerCase()));
  }

  const nextKb: KnowledgeBase = {
    ...kb,
    relationships: { ...relationships, people, removedKeys },
  };
  return { kb: nextKb, person };
}

function mergePeople(
  kb: KnowledgeBase,
  targetId: string,
  sourceId: string,
): { kb: KnowledgeBase; person: ProfilePerson | null } {
  const target = findPersonById(kb, targetId);
  const source = findPersonById(kb, sourceId);
  if (!target || !source || targetId === sourceId) return { kb, person: target ?? null };

  const { kb: merged } = upsertPerson(kb, {
    ...target,
    emails: [...personEmails(target), ...personEmails(source)],
    phones: [...personPhones(target), ...personPhones(source)],
    company: target.company ?? source.company,
    relationship: target.relationship ?? source.relationship,
    notes: [target.notes, source.notes].filter(Boolean).join('\n') || undefined,
    sources: [...(target.sources ?? []), ...(source.sources ?? [])],
  });

  const { kb: next } = setPersonStatus(merged, sourceId, 'removed');
  return { kb: next, person: findPersonById(next, targetId) ?? null };
}

/** Attach an email or phone to an existing person; merges duplicate person records when found. */
export function addContactToPerson(
  kb: KnowledgeBase,
  personId: string,
  contact: { email?: string; phone?: string },
): { kb: KnowledgeBase; person: ProfilePerson | null } {
  const person = findPersonById(kb, personId);
  if (!person) return { kb, person: null };

  const email = contact.email?.trim();
  const phone = contact.phone?.trim();
  if (!email && !phone) return { kb, person };

  let next = kb;
  if (email) {
    const dup = findPersonByContact(next, email);
    if (dup && dup.id !== personId) {
      next = mergePeople(next, personId, dup.id).kb;
    }
  }

  const current = findPersonById(next, personId);
  if (!current) return { kb, person: null };

  return upsertPerson(next, {
    ...current,
    emails: email ? [...personEmails(current), email] : personEmails(current),
    phones: phone ? [...personPhones(current), phone] : personPhones(current),
    sources: ['manual'],
  });
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
      email: p.email ?? p.emails?.[0],
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

export interface UnlinkedContactSignal {
  name: string;
  email?: string;
  phone?: string;
  lastTouch?: string;
}

/** Graph or sync signals not yet linked to a canonical person record. */
export function listUnlinkedContactSignals(kb: KnowledgeBase): UnlinkedContactSignal[] {
  const linked = new Set<string>();
  for (const person of kb.relationships?.people ?? []) {
    if (person.status === 'removed') continue;
    for (const key of personContactKeys(person)) linked.add(key.toLowerCase());
  }

  const out: UnlinkedContactSignal[] = [];
  const seen = new Set<string>();

  for (const entry of kb.relationships?.interactionGraph?.entries ?? []) {
    const email = entry.email?.trim();
    if (!email) continue;
    const key = normalizeEmail(email);
    if (linked.has(key) || seen.has(key)) continue;
    if (isContactBlocked(kb, { name: entry.name, email })) continue;
    seen.add(key);
    out.push({ name: entry.name, email, lastTouch: entry.lastTouch });
  }

  return out.sort((a, b) =>
    new Date(b.lastTouch ?? 0).getTime() - new Date(a.lastTouch ?? 0).getTime(),
  );
}
