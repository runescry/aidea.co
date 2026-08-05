import { NextResponse } from 'next/server';
import { getRegisteredNangoUserId } from '@/lib/auth/accounts';
import { normalizeUserId, setCurrentGoogleUser } from '@/lib/auth/session';
import { hasGoogleConnectionsForEndUser, invalidateNangoConnectionsCache } from '@/lib/nango/connections';
import { mergeProfile } from '@/lib/storage';

export const runtime = 'nodejs';

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

  if (!(await hasGoogleConnectionsForEndUser(nangoUserId))) {
    return NextResponse.json({ error: 'Google connections are missing — reconnect required' }, { status: 409 });
  }

  await setCurrentGoogleUser(userId, nangoUserId);
  await mergeProfile({ 'preferences.onboardingComplete': true }).catch(() => undefined);
  invalidateNangoConnectionsCache();

  return NextResponse.json({ ok: true, userId, resumed: true });
}
