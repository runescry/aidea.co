import { readAllKB } from '@/lib/harness/knowledge-base';
import type { KnowledgeBase, SchoolFeed } from '@/types/knowledge-base';

/** Read persisted school feed for the current tenant (dynamic — uses session/cookies). */
export async function readSchoolFeed(): Promise<SchoolFeed | null> {
  const kb = await readAllKB() as KnowledgeBase;
  return kb.family?.schoolFeed ?? null;
}
