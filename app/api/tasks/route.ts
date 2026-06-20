import { NextRequest, NextResponse } from 'next/server';
import { listActions } from '@/lib/harness/queue';
import { buildUnifiedTaskFeed } from '@/lib/harness/tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { readAllKB } from '@/lib/harness/knowledge-base';
import { loadEntityStates } from '@/lib/storage';
import { autonomyHint, autonomyLabel } from '@/lib/harness/proactive-tasks';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const summary = new URL(req.url).searchParams.get('summary') === '1';

  const [actions, entities, kb] = await Promise.all([
    listActions(),
    loadEntityStates(),
    readAllKB(),
  ]);
  const { tasks, needsYou, autonomy } = buildUnifiedTaskFeed({
    actions,
    entities,
    kb: kb as KnowledgeBase,
  });

  if (summary) {
    return NextResponse.json({ needsYou });
  }

  return NextResponse.json({
    tasks,
    needsYou,
    autonomy: autonomy
      ? { level: autonomy, label: autonomyLabel(autonomy), hint: autonomyHint(autonomy) }
      : null,
  });
}
