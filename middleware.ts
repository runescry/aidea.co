import { NextRequest, NextResponse } from 'next/server';
import { AIDEA_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session-token';

const PUBLIC_API_PREFIXES = ['/api/auth/session', '/api/eval/', '/api/monitor'];
const PENDING_GOOGLE_PREFIXES = ['/api/nango/', '/api/auth/google/complete'];

export async function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some(prefix => req.nextUrl.pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  let session = null;
  try {
    session = await verifySessionToken(req.cookies.get(AIDEA_SESSION_COOKIE)?.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session authentication is not configured';
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!session.verified && !PENDING_GOOGLE_PREFIXES.some(prefix => req.nextUrl.pathname.startsWith(prefix))) {
    return NextResponse.json({ error: 'Complete Google sign-in to continue' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
