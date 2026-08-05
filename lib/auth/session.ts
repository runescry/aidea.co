import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import {
  createSessionToken,
  AIDEA_SESSION_COOKIE,
  sessionMaxAgeSeconds,
  verifySessionToken,
  type AideaSession,
} from './session-token';
import { getUserExecutionContext } from './user-context';

export const AIDEA_USER_COOKIE = 'aidea-user-id';
export const AIDEA_AUTH_MODE_COOKIE = 'aidea-auth-mode';
export { AIDEA_SESSION_COOKIE } from './session-token';

export type AideaAuthMode = 'google' | 'demo';

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

async function readSession(): Promise<AideaSession | null> {
  try {
    const store = await cookies();
    return verifySessionToken(store.get(AIDEA_SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function getCurrentUserId(): Promise<string> {
  const context = getUserExecutionContext();
  if (context) return context.userId;
  return (await readSession())?.userId ?? fallbackUserId();
}

export async function getCurrentAuthMode(): Promise<AideaAuthMode | 'default'> {
  return (await readSession())?.mode ?? 'default';
}

export async function isCurrentSessionVerified(): Promise<boolean> {
  return (await readSession())?.verified ?? false;
}

export async function getCurrentNangoUserId(): Promise<string> {
  const context = getUserExecutionContext();
  if (context) return context.nangoUserId;
  const session = await readSession();
  return session?.nangoUserId ?? session?.userId ?? fallbackUserId();
}

async function writeSession(session: Omit<AideaSession, 'expiresAt'>): Promise<void> {
  const store = await cookies();
  store.set(AIDEA_SESSION_COOKIE, await createSessionToken(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAgeSeconds,
  });
}

export async function setCurrentUser(mode: AideaAuthMode): Promise<string> {
  const existing = await readSession();
  const userId = existing?.mode === mode ? existing.userId : createUserId(mode);
  await writeSession({
    userId,
    mode,
    verified: mode === 'demo',
    ...(mode === 'google' ? { nangoUserId: existing?.mode === mode ? existing.nangoUserId ?? userId : userId } : {}),
  });
  return userId;
}

export async function setCurrentGoogleUser(userId: string, nangoUserId: string): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedNangoUserId = normalizeUserId(nangoUserId);
  if (!normalizedUserId?.startsWith('google:') || !normalizedNangoUserId?.startsWith('google:')) {
    throw new Error('Google session ids are invalid');
  }
  await writeSession({ userId: normalizedUserId, mode: 'google', verified: true, nangoUserId: normalizedNangoUserId });
}

export async function clearCurrentUser(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(AIDEA_SESSION_COOKIE);
    store.delete(AIDEA_USER_COOKIE);
    store.delete(AIDEA_AUTH_MODE_COOKIE);
  } catch {
    // Route contract tests and CLI callers may not have a Next request cookie store.
  }
}

export function isDemoUserId(userId: string): boolean {
  return userId.startsWith('demo:');
}
