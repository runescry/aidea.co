import { NextResponse } from 'next/server';
import { getCurrentNangoUserId, getCurrentUserId, setCurrentGoogleUser } from '@/lib/auth/session';
import { stableGoogleUserId } from '@/lib/auth/session-token';
import { getConnectedGoogleIdentity, invalidateNangoConnectionsCache, deleteAllConnectionsForEndUser } from '@/lib/nango/connections';
import { claimTenantData } from '@/lib/storage/tenant-copy';
import { getRegisteredNangoUserId, registerGoogleAccount } from '@/lib/auth/accounts';
import { mergeProfile } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const [temporaryUserId, nangoUserId, identity] = await Promise.all([
      getCurrentUserId(),
      getCurrentNangoUserId(),
      getConnectedGoogleIdentity(),
    ]);
    const userId = await stableGoogleUserId(identity.email);
    const existingNangoUserId = await getRegisteredNangoUserId(userId);
    const canonicalNangoUserId = existingNangoUserId ?? nangoUserId;

    if (temporaryUserId !== userId) {
      await claimTenantData(temporaryUserId, userId);
    }
    await setCurrentGoogleUser(userId, canonicalNangoUserId);

    if (existingNangoUserId && existingNangoUserId !== nangoUserId) {
      await deleteAllConnectionsForEndUser(nangoUserId).catch(() => 0);
    }

    // Best-effort — a monitor-registration hiccup shouldn't fail the sign-in itself.
    await registerGoogleAccount(userId, canonicalNangoUserId).catch(() => undefined);
    await mergeProfile({ 'preferences.onboardingComplete': true }).catch(() => undefined);
    invalidateNangoConnectionsCache();
    return NextResponse.json({ ok: true, userId, email: identity.email, displayName: identity.displayName });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to finish Google sign-in';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
