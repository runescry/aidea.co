import { NextResponse } from 'next/server';
import { getRegisteredNangoUserId } from '@/lib/auth/accounts';
import { normalizeUserId, setPendingGoogleResume } from '@/lib/auth/session';
import { hasGoogleConnectionsForEndUser } from '@/lib/nango/connections';

export const runtime = 'nodejs';

/** Scope the pending session to an existing Nango end-user before opening Connect UI. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { userId?: unknown };
  const userId = normalizeUserId(typeof body.userId === 'string' ? body.userId : null);
  if (!userId?.startsWith('google:')) {
    return NextResponse.json({ error: 'A valid google user id is required' }, { status: 400 });
  }

  const nangoUserId = await getRegisteredNangoUserId(userId);
  if (!nangoUserId) {
    return NextResponse.json({ error: 'No saved Google account for this device' }, { status: 404 });
  }

  const hasConnections = await hasGoogleConnectionsForEndUser(nangoUserId);
  await setPendingGoogleResume(userId, nangoUserId);

  return NextResponse.json({ ok: true, userId, nangoUserId, hasConnections });
}
