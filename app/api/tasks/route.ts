import { NextRequest, NextResponse } from 'next/server';
import { listActionsForFeed, scrubQueuePayloadBloat } from '@/lib/harness/queue-feed';
import { buildUnifiedTaskFeed, isStaleRunningEntity, normalizeEntityForFeed } from '@/lib/harness/tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { readAllKB } from '@/lib/harness/knowledge-base';
import { countPendingQueuedActions, loadEntityStates, readLatestBrief, readProfile, saveEntityState, writeLatestBrief } from '@/lib/storage';
import { collapsePendingQueueDuplicates } from '@/lib/harness/queue';
import { readProactiveHygiene, autonomyHint, autonomyLabel } from '@/lib/harness/proactive-tasks';
import { listQueueAudit } from '@/lib/harness/queue-audit';
import {
  readDomainAutonomy,
  domainAutonomyLabel,
  domainAutonomyHint,
  type AutonomyDomain,
} from '@/lib/harness/domain-autonomy';
import { getDevTasksCache, invalidateDevTasksCache, setDevTasksCache } from '@/lib/harness/tasks-cache';
import { enrichBriefMustDoFromGmail } from '@/lib/harness/morning-brief-enrich';
import { normalizeMorningBrief, nonEmpty } from '@/lib/harness/morning-brief-must-do';

export const runtime = 'nodejs';

let queueScrubPromise: Promise<void> | null = null;

async function ensureQueueHygiene(): Promise<void> {
  if (!queueScrubPromise) {
    queueScrubPromise = Promise.all([
      scrubQueuePayloadBloat(),
      collapsePendingQueueDuplicates(),
    ])
      .then(([scrubbed, collapsed]) => {
        if (scrubbed > 0 || collapsed > 0) invalidateDevTasksCache();
      })
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

  void ensureQueueHygiene();

  const cached = getDevTasksCache();
  if (cached) {
    return NextResponse.json(cached);
  }

  const [actions, rawEntities, kb, briefRaw, profile, audit] = await Promise.all([
    listActionsForFeed(),
    loadEntityStates(),
    readAllKB(),
    readLatestBrief(),
    readProfile(),
    listQueueAudit(200),
  ]);

  const brief = briefRaw ? normalizeMorningBrief(briefRaw) : null;

  if (briefRaw) {
    void enrichBriefMustDoFromGmail(briefRaw)
      .then(enriched => {
        const enrichedBrief = enriched ? normalizeMorningBrief(enriched) : null;
        if (!enrichedBrief || !Array.isArray(enrichedBrief.mustDo) || !Array.isArray(briefRaw.mustDo)) return;
        const gainedSubject = (enrichedBrief.mustDo as Record<string, unknown>[]).some((row, i) => {
          const prior = (briefRaw.mustDo as Record<string, unknown>[])[i];
          return nonEmpty(row.subject) && !nonEmpty(prior?.subject);
        });
        if (gainedSubject) {
          return writeLatestBrief(enrichedBrief);
        }
      })
      .catch(() => undefined);
  }

  const stale = rawEntities.filter(isStaleRunningEntity);
  if (stale.length > 0) {
    void Promise.all(
      stale.map(entity =>
        saveEntityState({
          ...entity,
          status: 'error',
          updatedAt: new Date().toISOString(),
          data: {
            ...entity.data,
            lastError: entity.data.lastError ?? 'Run timed out or was interrupted before finishing',
          },
        }),
      ),
    );
  }
  const entities = rawEntities.map(entity => normalizeEntityForFeed(
    isStaleRunningEntity(entity)
      ? { ...entity, updatedAt: new Date().toISOString() }
      : entity,
  ));
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
