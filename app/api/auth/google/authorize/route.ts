import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  buildGoogleAuthorizeUrl,
  googleOAuthConfigured,
  googleOAuthMisconfigMessage,
} from '@/lib/auth/google-oauth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!googleOAuthConfigured()) {
    return NextResponse.json({ error: googleOAuthMisconfigMessage() }, { status: 503 });
  }

  const origin = new URL(req.url).origin;
  const state = randomUUID();
  const res = NextResponse.redirect(buildGoogleAuthorizeUrl(origin, state));
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  return res;
}
