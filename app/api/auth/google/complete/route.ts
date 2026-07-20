import { NextResponse } from 'next/server';
import { getCurrentNangoUserId, getCurrentUserId, setCurrentGoogleUser } from '@/lib/auth/session';
import { stableGoogleUserId } from '@/lib/auth/session-token';
import { getConnectedGoogleIdentity, invalidateNangoConnectionsCache } from '@/lib/nango/connections';
import { claimTenantData } from '@/lib/storage/tenant-copy';
import { registerGoogleAccount } from '@/lib/auth/accounts';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const [temporaryUserId, nangoUserId, identity] = await Promise.all([
      getCurrentUserId(),
      getCurrentNangoUserId(),
      getConnectedGoogleIdentity(),
    ]);
    const userId = await stableGoogleUserId(identity.email);
    await claimTenantData(temporaryUserId, userId);
    await registerGoogleAccount(userId, nangoUserId);
    await setCurrentGoogleUser(userId, nangoUserId);
    invalidateNangoConnectionsCache();
    return NextResponse.json({ ok: true, userId, email: identity.email, displayName: identity.displayName });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to finish Google sign-in';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
