import { NextResponse } from 'next/server';
import { clearCurrentUser, getCurrentAuthMode, getCurrentUserId, setCurrentUser, type AideaAuthMode } from '@/lib/auth/session';

export const runtime = 'nodejs';

function parseMode(value: unknown): AideaAuthMode | null {
  return value === 'google' || value === 'demo' ? value : null;
}

export async function GET() {
  const [userId, mode] = await Promise.all([getCurrentUserId(), getCurrentAuthMode()]);
  return NextResponse.json({ userId, mode });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { mode?: unknown };
  const mode = parseMode(body.mode);
  if (!mode) return NextResponse.json({ error: 'mode must be google or demo' }, { status: 400 });
  const userId = await setCurrentUser(mode);
  return NextResponse.json({ ok: true, userId, mode });
}

export async function DELETE() {
  await clearCurrentUser();
  return NextResponse.json({ ok: true });
}
