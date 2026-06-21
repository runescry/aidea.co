import type { KnowledgeBase, PersonContact, ProfilePerson, ProfilePersonSource } from '@/types/knowledge-base';
import { personKey } from './people';

function legacyContactGroups(kb: KnowledgeBase): Array<{ person: PersonContact; relationship: string; source: ProfilePersonSource }> {
  const out: Array<{ person: PersonContact; relationship: string; source: ProfilePersonSource }> = [];
  const rel = kb.relationships;
  const groups: Array<[PersonContact[] | undefined, string]> = [
    [rel?.mentors, 'mentor'],
    [rel?.collaborators, 'collaborator'],
    [rel?.innerCircle, 'inner circle'],
    [rel?.friends, 'friend'],
  ];
  for (const [list, relationship] of groups) {
    for (const person of list ?? []) {
      if (!person.name?.trim()) continue;
      out.push({ person, relationship: person.relationship ?? relationship, source: 'manual' });
    }
  }
  for (const person of kb.work?.keyContacts ?? []) {
    if (!person.name?.trim()) continue;
    out.push({ person, relationship: person.relationship ?? 'contact', source: 'manual' });
  }
  return out;
}

/** Idempotent backfill from legacy relationship lists into relationships.people. */
export function ensurePeopleStore(kb: KnowledgeBase): KnowledgeBase {
  const existing = kb.relationships?.people ?? [];
  if (existing.length > 0) return kb;

  const legacy = legacyContactGroups(kb);
  if (legacy.length === 0) return kb;

  const byKey = new Map<string, ProfilePerson>();
  for (const { person, relationship, source } of legacy) {
    const key = personKey({ name: person.name!, email: person.email });
    const prev = byKey.get(key);
    byKey.set(key, {
      id: prev?.id ?? crypto.randomUUID(),
      name: person.name!.trim(),
      email: person.email?.trim() || undefined,
      company: person.company?.trim() || prev?.company,
      relationship: prev?.relationship ?? relationship,
      notes: person.notes ?? prev?.notes,
      status: 'active',
      sources: [...new Set([...(prev?.sources ?? []), source])],
    });
  }

  return {
    ...kb,
    relationships: {
      ...(kb.relationships ?? {}),
      people: [...byKey.values()],
    },
  };
}
