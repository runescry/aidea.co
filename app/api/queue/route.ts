import { NextRequest, NextResponse } from 'next/server';
import { listActions, updateActionStatus, clearResolved } from '@/lib/harness/queue';
import type { ActionStatus } from '@/lib/harness/queue';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as ActionStatus | null;

  const actions = await listActions(status ? { status } : undefined);
  return NextResponse.json(actions);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: string; status: ActionStatus };

  if (!body.id || !body.status) {
    return NextResponse.json({ error: '"id" and "status" are required' }, { status: 400 });
  }

  const action = await updateActionStatus(body.id, body.status);
  if (!action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, action });
}

export async function DELETE() {
  const cleared = await clearResolved();
  return NextResponse.json({ ok: true, cleared });
}
