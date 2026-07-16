import { readAllKB, writeManyKB } from '@/lib/harness/knowledge-base';
import {
  findPersonByKey,
  isContactBlocked,
  personKey,
  setPersonStatus,
  upsertPerson,
} from '@/lib/profile/people';
import type { KnowledgeBase, ProfilePerson, ProfilePersonStatus } from '@/types/knowledge-base';
import { getKb } from './helpers';

export const E2E_PERSON_PREFIX = 'aidea-e2e-person-';

export function e2ePersonEmail(runId: number | string): string {
  return `${E2E_PERSON_PREFIX}${runId}@test.local`;
}

export async function readKbState(): Promise<KnowledgeBase> {
  return await readAllKB() as KnowledgeBase;
}

export async function getKbJson(): Promise<KnowledgeBase> {
  const res = await getKb();
  if (!res.ok) throw new Error(`GET /api/kb failed: ${res.status}`);
  return await res.json() as KnowledgeBase;
}

export async function seedE2ePerson(
  runId: number | string,
  relationship = 'friend',
): Promise<ProfilePerson> {
  const kb = await readKbState();
  const email = e2ePersonEmail(runId);
  const { kb: next, person } = upsertPerson(kb, {
    name: `E2E Person ${runId}`,
    email,
    relationship,
    sources: ['manual'],
  });
  await writeManyKB({ relationships: next.relationships });
  return person;
}

export async function setE2ePersonStatus(id: string, status: ProfilePersonStatus): Promise<void> {
  const kb = await readKbState();
  const { kb: next } = setPersonStatus(kb, id, status);
  await writeManyKB({ relationships: next.relationships });
}

export function findE2ePerson(kb: KnowledgeBase, runId: number | string): ProfilePerson | undefined {
  return findPersonByKey(kb, personKey({ name: `E2E Person ${runId}`, email: e2ePersonEmail(runId) }));
}

export function isE2ePersonBlocked(kb: KnowledgeBase, runId: number | string): boolean {
  return isContactBlocked(kb, {
    name: `E2E Person ${runId}`,
    email: e2ePersonEmail(runId),
  });
}

export async function appendMemoryHygieneDismiss(pulseId: string): Promise<void> {
  const kb = await readKbState();
  const hygiene = kb.preferences?.memoryHygiene ?? {};
  const dismissed = [...new Set([...(hygiene.dismissedPulseIds ?? []), pulseId])];
  await writeManyKB({
    preferences: {
      ...(kb.preferences ?? {}),
      memoryHygiene: { ...hygiene, dismissedPulseIds: dismissed },
    },
  });
}
