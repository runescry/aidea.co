import { NextResponse } from 'next/server';
import { listActions } from '@/lib/harness/queue';
import { buildUnifiedTaskFeed } from '@/lib/harness/tasks';
import { loadEntityStates } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET() {
  const [actions, entities] = await Promise.all([listActions(), loadEntityStates()]);
  const { tasks, needsYou } = buildUnifiedTaskFeed({ actions, entities });

  return NextResponse.json({ tasks, needsYou });
}
