import { NextRequest, NextResponse } from 'next/server';
import { readAllKB, writeKB, writeManyKB } from '@/lib/harness/knowledge-base';
import { redactProfileSecrets } from '@/lib/api/redact-profile';

export const runtime = 'nodejs';

export async function GET() {
  const data = await readAllKB();
  return NextResponse.json(redactProfileSecrets(data));
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { key?: string; value?: unknown; updates?: Record<string, unknown> };

  if (body.updates) {
    await writeManyKB(body.updates);
  } else {
    if (body.key === undefined) {
      return NextResponse.json({ error: 'body must include "key" or "updates"' }, { status: 400 });
    }
    await writeKB(body.key, body.value);
  }

  return NextResponse.json({ ok: true });
}
