import { NextRequest, NextResponse } from 'next/server';
import {
  listActions,
  resolveQueueAction,
  resolveQueueActions,
  clearResolved,
  type QueueEditOverrides,
  type QueueIntent,
} from '@/lib/harness/queue';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const actions = await listActions(status ? { status: status as import('@/lib/harness/queue').ActionStatus } : undefined);
    return NextResponse.json(actions);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load queue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id?: string;
      ids?: string[];
      intent?: QueueIntent;
      status?: string;
      edits?: QueueEditOverrides;
      editsById?: Record<string, QueueEditOverrides>;
    };

    const intent: QueueIntent | null = body.intent
      ?? (body.status === 'approved' ? 'approve' : body.status === 'rejected' ? 'reject' : null);

    if (!intent) {
      return NextResponse.json({ error: '"intent" (approve | save | reject) is required' }, { status: 400 });
    }

    const ids = body.ids?.length
      ? body.ids
      : body.id
        ? [body.id]
        : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: '"id" or "ids" is required' }, { status: 400 });
    }

    if (ids.length === 1) {
      const action = await resolveQueueAction(ids[0], intent, body.edits);
      if (!action) {
        return NextResponse.json({ error: 'Action not found' }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        action,
        results: [{ id: ids[0], action }],
      });
    }

    const results = await resolveQueueActions(ids, intent, body.editsById);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Queue update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cleared = await clearResolved();
    return NextResponse.json({ ok: true, cleared });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to clear queue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
