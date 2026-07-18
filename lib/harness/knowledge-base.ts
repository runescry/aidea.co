import { readProfile, writeProfile, mergeProfile } from '@/lib/storage';
import { getCurrentUserId } from '@/lib/auth/session';
import { getNestedKey, setNestedKey } from '@/lib/storage/nested-keys';
import { ensureGraphPeopleLinked, ensurePeopleStore } from '@/lib/profile/people-migrate';
import { getEvalHarnessContext } from '@/lib/eval/eval-context';
import type { KnowledgeBase } from '@/types/knowledge-base';

let profileCache = new Map<string, { data: Record<string, unknown>; at: number }>();
const PROFILE_CACHE_MS = process.env.NODE_ENV === 'development' ? 60_000 : 15_000;

function invalidateProfileCache(): void {
  profileCache = new Map();
}

async function cachedReadProfile(): Promise<Record<string, unknown>> {
  const userId = await getCurrentUserId();
  const now = Date.now();
  const cached = profileCache.get(userId);
  if (cached && now - cached.at < PROFILE_CACHE_MS) {
    return cached.data;
  }
  const data = await readProfile();
  profileCache.set(userId, { data, at: now });
  return data;
}

function kbDataSource(): Promise<Record<string, unknown>> {
  const fixture = getEvalHarnessContext()?.kbFixture;
  if (fixture) {
    return Promise.resolve({ ...fixture } as Record<string, unknown>);
  }
  return cachedReadProfile();
}

export async function readKB(keys: string[]): Promise<Record<string, unknown>> {
  const data = await kbDataSource();
  return Object.fromEntries(keys.map(k => [k, getNestedKey(data, k) ?? null]));
}

export async function readAllKB(): Promise<Record<string, unknown>> {
  const fixture = getEvalHarnessContext()?.kbFixture;
  if (fixture) {
    return { ...fixture } as Record<string, unknown>;
  }
  const data = await cachedReadProfile();
  let migrated = ensurePeopleStore(data as KnowledgeBase);
  migrated = ensureGraphPeopleLinked(migrated);
  if (migrated !== data) {
    invalidateProfileCache();
    await mergeProfile({ relationships: migrated.relationships });
    return migrated as Record<string, unknown>;
  }
  return data;
}

export async function writeKB(key: string, value: unknown): Promise<void> {
  if (getEvalHarnessContext()?.skipQueueWrites) return;
  const data = await readProfile();
  setNestedKey(data, key, value);
  invalidateProfileCache();
  await writeProfile(data);
}

export async function writeManyKB(updates: Record<string, unknown>): Promise<void> {
  if (getEvalHarnessContext()?.skipQueueWrites) return;
  invalidateProfileCache();
  await mergeProfile(updates);
}

// Re-export for dot-notation merge helper
export { mergeProfile };
