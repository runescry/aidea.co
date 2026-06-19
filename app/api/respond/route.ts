import { NextRequest, NextResponse } from 'next/server';
import { resolveHumanInput } from '@/lib/harness/pending-inputs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json() as { requestId?: string; answer?: string };

  if (!body.requestId || body.answer === undefined) {
    return NextResponse.json(
      { error: '"requestId" and "answer" are required' },
      { status: 400 }
    );
  }

  const resolved = await resolveHumanInput(body.requestId, body.answer);

  if (!resolved) {
    return NextResponse.json(
      { error: 'Request not found or already resolved' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
