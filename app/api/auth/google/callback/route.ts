import { NextRequest, NextResponse } from 'next/server';
import { getRegisteredNangoUserId, registerGoogleAccount } from '@/lib/auth/accounts';
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  exchangeGoogleAuthCode,
  googleOAuthConfigured,
  newGoogleNangoUserId,
  stableUserIdFromGoogleEmail,
} from '@/lib/auth/google-oauth';
import { setCurrentGoogleUser, setPendingGoogleResume } from '@/lib/auth/session';
import { hasGoogleConnectionsForEndUser, invalidateNangoConnectionsCache } from '@/lib/nango/connections';
import { mergeProfile } from '@/lib/storage';

export const runtime = 'nodejs';

function redirectWithError(origin: string, message: string): NextResponse {
  const url = new URL('/', origin);
  url.searchParams.set('google_error', message.slice(0, 180));
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  if (!googleOAuthConfigured()) {
    return redirectWithError(origin, 'Google sign-in is not configured on this deployment');
  }

  const url = new URL(req.url);
  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    return redirectWithError(origin, oauthError);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(origin, 'Google sign-in state mismatch — try again');
  }

  try {
    const identity = await exchangeGoogleAuthCode(origin, code);
    const userId = await stableUserIdFromGoogleEmail(identity.email);
    const registeredNangoUserId = await getRegisteredNangoUserId(userId);
    const nangoUserId = registeredNangoUserId ?? newGoogleNangoUserId();
    const hasConnections = registeredNangoUserId
      ? await hasGoogleConnectionsForEndUser(registeredNangoUserId)
      : false;

    if (hasConnections) {
      await setCurrentGoogleUser(userId, nangoUserId);
      await registerGoogleAccount(userId, nangoUserId).catch(() => undefined);
      await mergeProfile({ 'preferences.onboardingComplete': true }).catch(() => undefined);
      invalidateNangoConnectionsCache();

      const res = NextResponse.redirect(new URL('/', origin));
      res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
      return res;
    }

    await setPendingGoogleResume(userId, nangoUserId);
    if (!registeredNangoUserId) {
      await registerGoogleAccount(userId, nangoUserId).catch(() => undefined);
    }

    const connectUrl = new URL('/', origin);
    connectUrl.searchParams.set('google_connect', '1');
    const res = NextResponse.redirect(connectUrl);
    res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google sign-in failed';
    return redirectWithError(origin, message);
  }
}
