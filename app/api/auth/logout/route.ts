import { NextRequest, NextResponse } from 'next/server';
import { clearCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await clearCurrentUser();
  const url = new URL('/', req.url);
  url.searchParams.set('signed_out', '1');
  return NextResponse.redirect(url);
}
