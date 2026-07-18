import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

export const AIDEA_USER_COOKIE = 'aidea-user-id';
export const AIDEA_AUTH_MODE_COOKIE = 'aidea-auth-mode';

export type AideaAuthMode = 'google' | 'demo';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function fallbackUserId(): string {
  return process.env.DEFAULT_USER_ID ?? 'default';
}

function cleanSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function createUserId(mode: AideaAuthMode): string {
  return `${mode}:${randomUUID()}`;
}

export function normalizeUserId(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const [prefix, rest] = trimmed.split(':', 2);
  if ((prefix !== 'google' && prefix !== 'demo') || !rest) return null;
  const clean = cleanSegment(rest);
  return clean ? `${prefix}:${clean}` : null;
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const store = await cookies();
    return normalizeUserId(store.get(AIDEA_USER_COOKIE)?.value) ?? fallbackUserId();
  } catch {
    return fallbackUserId();
  }
}

export async function getCurrentAuthMode(): Promise<AideaAuthMode | 'default'> {
  try {
    const store = await cookies();
    const mode = store.get(AIDEA_AUTH_MODE_COOKIE)?.value;
    if (mode === 'google' || mode === 'demo') return mode;
  } catch {
    // fall through
  }
  return 'default';
}

export async function setCurrentUser(mode: AideaAuthMode): Promise<string> {
  const store = await cookies();
  const existing = normalizeUserId(store.get(AIDEA_USER_COOKIE)?.value);
  const userId = existing?.startsWith(`${mode}:`) ? existing : createUserId(mode);
  const secure = process.env.NODE_ENV === 'production';
  store.set(AIDEA_USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  store.set(AIDEA_AUTH_MODE_COOKIE, mode, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return userId;
}

export async function clearCurrentUser(): Promise<void> {
  const store = await cookies();
  store.delete(AIDEA_USER_COOKIE);
  store.delete(AIDEA_AUTH_MODE_COOKIE);
}

export function isDemoUserId(userId: string): boolean {
  return userId.startsWith('demo:');
}
