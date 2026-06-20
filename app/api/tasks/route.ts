import { NextRequest, NextResponse } from 'next/server';
import { listActions } from '@/lib/harness/queue';
import { buildUnifiedTaskFeed, isStaleRunningEntity } from '@/lib/harness/tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { readAllKB } from '@/lib/harness/knowledge-base';
import { loadEntityStates, saveEntityState } from '@/lib/storage';
import { autonomyHint, autonomyLabel } from '@/lib/harness/proactive-tasks';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const summary = new URL(req.url).searchParams.get('summary') === '1';

  const [actions, rawEntities, kb] = await Promise.all([
    listActions(),
    loadEntityStates(),
    readAllKB(),
  ]);

  const stale = rawEntities.filter(isStaleRunningEntity);
  if (stale.length > 0) {
    await Promise.all(
      stale.map(entity => saveEntityState({ ...entity, status: 'error', updatedAt: new Date().toISOString() })),
    );
  }
  const entities = rawEntities.map(entity =>
    isStaleRunningEntity(entity)
      ? { ...entity, status: 'error' as const, updatedAt: new Date().toISOString() }
      : entity,
  );
  const { tasks, needsYou, suggestions, autonomy } = buildUnifiedTaskFeed({
    actions,
    entities,
    kb: kb as KnowledgeBase,
  });

  if (summary) {
    return NextResponse.json({ needsYou, suggestions });
  }

  return NextResponse.json({
    tasks,
    needsYou,
    suggestions,
    autonomy: autonomy
      ? { level: autonomy, label: autonomyLabel(autonomy), hint: autonomyHint(autonomy) }
      : null,
  });
}
