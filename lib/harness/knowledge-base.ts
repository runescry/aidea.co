import { readProfile, writeProfile, mergeProfile } from '@/lib/storage';
import { getNestedKey, setNestedKey } from '@/lib/storage/nested-keys';

let profileCache: { data: Record<string, unknown>; at: number } | null = null;
const PROFILE_CACHE_MS = process.env.NODE_ENV === 'development' ? 60_000 : 15_000;

function invalidateProfileCache(): void {
  profileCache = null;
}

async function cachedReadProfile(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (profileCache && now - profileCache.at < PROFILE_CACHE_MS) {
    return profileCache.data;
  }
  const data = await readProfile();
  profileCache = { data, at: now };
  return data;
}

export async function readKB(keys: string[]): Promise<Record<string, unknown>> {
  const data = await cachedReadProfile();
  return Object.fromEntries(keys.map(k => [k, getNestedKey(data, k) ?? null]));
}

export async function readAllKB(): Promise<Record<string, unknown>> {
  return cachedReadProfile();
}

export async function writeKB(key: string, value: unknown): Promise<void> {
  const data = await readProfile();
  setNestedKey(data, key, value);
  invalidateProfileCache();
  await writeProfile(data);
}

export async function writeManyKB(updates: Record<string, unknown>): Promise<void> {
  invalidateProfileCache();
  await mergeProfile(updates);
}

// Re-export for dot-notation merge helper
export { mergeProfile };
