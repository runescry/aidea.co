import { NextRequest, NextResponse } from 'next/server';
import { connectStravaWithCode } from '@/lib/health/strava-client';
import { syncStravaToKb } from '@/lib/health/strava-sync';
import { stravaRedirectUri } from '@/lib/health/strava-config';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const error = searchParams.get('error');
  if (error) {
    return NextResponse.redirect(new URL(`/?settings=strava&error=${encodeURIComponent(error)}`, req.url));
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieState = req.cookies.get('strava_oauth_state')?.value;
  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL('/?settings=strava&error=invalid_state', req.url));
  }

  try {
    const origin = new URL(req.url).origin;
    await connectStravaWithCode(code, stravaRedirectUri(origin));
    await syncStravaToKb().catch(() => undefined);
    const res = NextResponse.redirect(new URL('/?settings=strava&connected=1', req.url));
    res.cookies.delete('strava_oauth_state');
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'connect_failed';
    return NextResponse.redirect(new URL(`/?settings=strava&error=${encodeURIComponent(message)}`, req.url));
  }
}
