import { NextRequest, NextResponse } from 'next/server';
import { listActions } from '@/lib/harness/queue';
import { buildUnifiedTaskFeed, isStaleRunningEntity } from '@/lib/harness/tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { readAllKB } from '@/lib/harness/knowledge-base';
import { countPendingQueuedActions, loadEntityStates, saveEntityState } from '@/lib/storage';
import { autonomyHint, autonomyLabel } from '@/lib/harness/proactive-tasks';
import { getDevTasksCache, setDevTasksCache } from '@/lib/harness/tasks-cache';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const summary = new URL(req.url).searchParams.get('summary') === '1';

  if (summary) {
    const needsYou = await countPendingQueuedActions();
    return NextResponse.json({ needsYou, suggestions: 0 });
  }

  const cached = getDevTasksCache();
  if (cached) {
    return NextResponse.json(cached);
  }

  const [actions, rawEntities, kb] = await Promise.all([
    listActions(),
    loadEntityStates(),
    readAllKB(),
  ]);

  const stale = rawEntities.filter(isStaleRunningEntity);
  if (stale.length > 0) {
    void Promise.all(
      stale.map(entity =>
        saveEntityState({ ...entity, status: 'error', updatedAt: new Date().toISOString() }),
      ),
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

  const payload = {
    tasks,
    needsYou,
    suggestions,
    autonomy: autonomy
      ? { level: autonomy, label: autonomyLabel(autonomy), hint: autonomyHint(autonomy) }
      : null,
  };

  setDevTasksCache(payload);
  return NextResponse.json(payload);
}
