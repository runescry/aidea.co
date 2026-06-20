import { NextRequest, NextResponse } from 'next/server';
import { listActionsForFeed, scrubQueuePayloadBloat } from '@/lib/harness/queue-feed';
import { buildUnifiedTaskFeed, isStaleRunningEntity } from '@/lib/harness/tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { readAllKB } from '@/lib/harness/knowledge-base';
import { countPendingQueuedActions, loadEntityStates, saveEntityState } from '@/lib/storage';
import { autonomyHint, autonomyLabel } from '@/lib/harness/proactive-tasks';
import { getDevTasksCache, invalidateDevTasksCache, setDevTasksCache } from '@/lib/harness/tasks-cache';

export const runtime = 'nodejs';

let queueScrubPromise: Promise<void> | null = null;

async function ensureQueueScrubbed(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return;
  if (!queueScrubPromise) {
    queueScrubPromise = scrubQueuePayloadBloat()
      .then(n => { if (n > 0) invalidateDevTasksCache(); })
      .catch(() => { /* best-effort */ });
  }
  await queueScrubPromise;
}

export async function GET(req: NextRequest) {
  const summary = new URL(req.url).searchParams.get('summary') === '1';

  if (summary) {
    const needsYou = await countPendingQueuedActions();
    return NextResponse.json({ needsYou, suggestions: 0 });
  }

  await ensureQueueScrubbed();

  const cached = getDevTasksCache();
  if (cached) {
    return NextResponse.json(cached);
  }

  const [actions, rawEntities, kb] = await Promise.all([
    listActionsForFeed(),
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
