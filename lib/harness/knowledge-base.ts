import { readProfile, writeProfile, mergeProfile } from '@/lib/storage';
import { getNestedKey, setNestedKey } from '@/lib/storage/nested-keys';

export async function readKB(keys: string[]): Promise<Record<string, unknown>> {
  const data = await readProfile();
  return Object.fromEntries(keys.map(k => [k, getNestedKey(data, k) ?? null]));
}

export async function readAllKB(): Promise<Record<string, unknown>> {
  return readProfile();
}

export async function writeKB(key: string, value: unknown): Promise<void> {
  const data = await readProfile();
  setNestedKey(data, key, value);
  await writeProfile(data);
}

export async function writeManyKB(updates: Record<string, unknown>): Promise<void> {
  const data = await readProfile();
  for (const [k, v] of Object.entries(updates)) {
    if (k.includes('.')) setNestedKey(data, k, v);
    else data[k] = v;
  }
  await writeProfile(data);
}

// Re-export for dot-notation merge helper
export { mergeProfile };
