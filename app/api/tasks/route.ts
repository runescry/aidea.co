import { NextResponse } from 'next/server';
import { listActions } from '@/lib/harness/queue';
import { queueActionToTask } from '@/lib/harness/tasks';

export const runtime = 'nodejs';

export async function GET() {
  const actions = await listActions();
  const tasks = actions
    .map(queueActionToTask)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const needsYou = tasks.filter(t => t.status === 'needs_you').length;

  return NextResponse.json({ tasks, needsYou });
}
