export type SessionMode = 'google' | 'demo';
export const AIDEA_SESSION_COOKIE = 'aidea-session';

export interface AideaSession {
  userId: string;
  mode: SessionMode;
  verified: boolean;
  nangoUserId?: string;
  expiresAt: number;
}

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const DEV_SESSION_SECRET = 'aidea-local-development-session-secret';

function sessionSecret(): string {
  const configured = process.env.AIDEA_SESSION_SECRET?.trim() || process.env.NANGO_SECRET_KEY?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AIDEA_SESSION_SECRET is required in production');
  }
  return DEV_SESSION_SECRET;
}

function tenantDerivationSecret(): string {
  const configured = process.env.AIDEA_TENANT_DERIVATION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AIDEA_TENANT_DERIVATION_SECRET is required in production');
  }
  return DEV_SESSION_SECRET;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function createSessionToken(
  session: Omit<AideaSession, 'expiresAt'>,
  now = Date.now(),
): Promise<string> {
  const payload: AideaSession = {
    ...session,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = bytesToBase64Url(await hmac(encoded, sessionSecret()));
  return `${encoded}.${signature}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<AideaSession | null> {
  if (!token) return null;
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) return null;

  const expected = await hmac(encoded, sessionSecret());
  const actual = base64UrlToBytes(signature);
  if (actual.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual[i] ^ expected[i];
  if (mismatch !== 0) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as AideaSession;
    if (parsed.mode !== 'google' && parsed.mode !== 'demo') return null;
    if (typeof parsed.verified !== 'boolean') return null;
    if (!parsed.userId || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function stableGoogleUserId(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) throw new Error('Google connection did not return an email address');
  return `google:${bytesToHex(await hmac(`google-account:${normalized}`, tenantDerivationSecret())).slice(0, 48)}`;
}

export const sessionMaxAgeSeconds = SESSION_MAX_AGE_SECONDS;
