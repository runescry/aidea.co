import { NextRequest, NextResponse } from 'next/server';
import { listActionsForFeed, scrubQueuePayloadBloat } from '@/lib/harness/queue-feed';
import { buildUnifiedTaskFeed, isStaleRunningEntity } from '@/lib/harness/tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { readAllKB } from '@/lib/harness/knowledge-base';
import { countPendingQueuedActions, loadEntityStates, readLatestBrief, readProfile, saveEntityState } from '@/lib/storage';
import { readProactiveHygiene, autonomyHint, autonomyLabel } from '@/lib/harness/proactive-tasks';
import { listQueueAudit } from '@/lib/harness/queue-audit';
import {
  readDomainAutonomy,
  domainAutonomyLabel,
  domainAutonomyHint,
  type AutonomyDomain,
} from '@/lib/harness/domain-autonomy';
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

  const [actions, rawEntities, kb, brief, profile, audit] = await Promise.all([
    listActionsForFeed(),
    loadEntityStates(),
    readAllKB(),
    readLatestBrief(),
    readProfile(),
    listQueueAudit(200),
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
  const kbTyped = kb as KnowledgeBase;
  const { tasks, needsYou, suggestions, timeline, autonomy } = buildUnifiedTaskFeed({
    actions,
    entities,
    kb: kbTyped,
    brief,
    audit,
    proactiveHygiene: readProactiveHygiene(profile),
  });

  const domainLevels = readDomainAutonomy(kbTyped);
  const defaultLevel = autonomy ?? domainLevels.email;

  const payload = {
    tasks,
    needsYou,
    suggestions,
    timeline,
    autonomy: {
      level: defaultLevel,
      label: autonomyLabel(defaultLevel),
      hint: autonomyHint(defaultLevel),
      domains: (Object.entries(domainLevels) as Array<[AutonomyDomain, typeof defaultLevel]>).map(
        ([domain, level]) => ({
          domain,
          level,
          label: domainAutonomyLabel(level),
          hint: domainAutonomyHint(domain, level),
        }),
      ),
    },
  };

  setDevTasksCache(payload);
  return NextResponse.json(payload);
}
