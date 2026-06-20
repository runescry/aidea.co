import { NextRequest, NextResponse } from 'next/server';
import { listActions, resolveQueueAction, clearResolved, type QueueIntent } from '@/lib/harness/queue';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const actions = await listActions(status ? { status: status as import('@/lib/harness/queue').ActionStatus } : undefined);
  return NextResponse.json(actions);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    id: string;
    intent?: QueueIntent;
    status?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: '"id" is required' }, { status: 400 });
  }

  const intent: QueueIntent | null = body.intent
    ?? (body.status === 'approved' ? 'approve' : body.status === 'rejected' ? 'reject' : null);

  if (!intent) {
    return NextResponse.json({ error: '"intent" (approve | save | reject) is required' }, { status: 400 });
  }

  const action = await resolveQueueAction(body.id, intent);
  if (!action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, action });
}

export async function DELETE() {
  const cleared = await clearResolved();
  return NextResponse.json({ ok: true, cleared });
}
