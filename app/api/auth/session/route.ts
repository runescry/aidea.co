import { NextResponse } from 'next/server';
import {
  clearCurrentUser,
  getCurrentAuthMode,
  getCurrentUserId,
  isCurrentSessionVerified,
  setCurrentUser,
  type AideaAuthMode,
} from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

function parseMode(value: unknown): AideaAuthMode | null {
  return value === 'google' || value === 'demo' ? value : null;
}

export async function GET() {
  const [userId, mode, authenticated] = await Promise.all([
    getCurrentUserId(),
    getCurrentAuthMode(),
    isCurrentSessionVerified(),
  ]);
  return NextResponse.json({ userId, mode, authenticated });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'auth-session', limit: 20, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({})) as { mode?: unknown };
  const mode = parseMode(body.mode);
  if (!mode) return NextResponse.json({ error: 'mode must be google or demo' }, { status: 400 });
  try {
    const userId = await setCurrentUser(mode);
    return NextResponse.json({ ok: true, userId, mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create session';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE() {
  await clearCurrentUser();
  return NextResponse.json({ ok: true });
}
