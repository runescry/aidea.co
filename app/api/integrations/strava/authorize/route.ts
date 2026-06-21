import { NextRequest, NextResponse } from 'next/server';
import { stravaAuthorizeUrl, stravaConfigured, stravaRedirectUri } from '@/lib/health/strava-config';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!stravaConfigured()) {
    return NextResponse.redirect(new URL('/?settings=strava&error=not_configured', req.url));
  }
  const origin = new URL(req.url).origin;
  const state = crypto.randomUUID();
  const redirectUri = stravaRedirectUri(origin);
  const url = stravaAuthorizeUrl(redirectUri, state);
  const res = NextResponse.redirect(url);
  res.cookies.set('strava_oauth_state', state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
