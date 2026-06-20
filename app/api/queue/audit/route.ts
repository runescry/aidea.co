import { NextResponse } from 'next/server';
import { listQueueAudit } from '@/lib/harness/queue-audit';

export const runtime = 'nodejs';

export async function GET() {
  const entries = await listQueueAudit();
  return NextResponse.json(entries);
}
