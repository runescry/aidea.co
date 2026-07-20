import { NextResponse } from 'next/server';
import { hasDatabase, getSql } from '@/lib/db/client';
import { ensureMigrated } from '@/lib/db/migrate';

interface RateLimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
}

type MemoryWindow = { count: number; expiresAt: number };

const globalForRateLimit = globalThis as typeof globalThis & {
  __aideaRateLimits?: Map<string, MemoryWindow>;
};

function memoryWindows(): Map<string, MemoryWindow> {
  if (!globalForRateLimit.__aideaRateLimits) {
    globalForRateLimit.__aideaRateLimits = new Map();
  }
  return globalForRateLimit.__aideaRateLimits;
}

function requestAddress(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function increment(
  scope: string,
  keyHash: string,
  windowStart: number,
  expiresAt: number,
): Promise<number> {
  if (!hasDatabase()) {
    const key = `${scope}:${keyHash}:${windowStart}`;
    const windows = memoryWindows();
    const current = windows.get(key);
    const count = (current?.count ?? 0) + 1;
    windows.set(key, { count, expiresAt });
    for (const [candidate, value] of windows) {
      if (value.expiresAt <= Date.now()) windows.delete(candidate);
    }
    return count;
  }

  await ensureMigrated();
  const sql = getSql();
  const [row] = await sql<[{ count: number }]>`
    INSERT INTO api_rate_limits (scope, key_hash, window_start, count, expires_at)
    VALUES (${scope}, ${keyHash}, ${windowStart}, 1, ${new Date(expiresAt).toISOString()})
    ON CONFLICT (scope, key_hash, window_start) DO UPDATE
    SET count = api_rate_limits.count + 1
    RETURNING count
  `;
  return row.count;
}

/** Fixed-window limit keyed by a one-way hash of the caller IP. */
export async function enforceRateLimit(
  req: Request,
  { scope, limit, windowMs }: RateLimitOptions,
): Promise<NextResponse | null> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = windowStart + windowMs;
  const keyHash = await sha256(requestAddress(req));
  const count = await increment(scope, keyHash, windowStart, expiresAt);
  if (count <= limit) return null;

  const retryAfter = Math.max(1, Math.ceil((expiresAt - now) / 1000));
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

export function resetMemoryRateLimitsForTests(): void {
  memoryWindows().clear();
}
