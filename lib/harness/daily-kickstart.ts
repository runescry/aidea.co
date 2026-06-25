import type { HarnessAgent, HarnessContext } from './types';
import { getAgentByRole, setAgentStatus } from './registry';
import { setStateKey } from './state';
import { executeHarnessTool } from './tools';
import { eventDateYmd } from '@/lib/calendar/dates';
import { userDateYmd, resolveUserTimezone } from '@/lib/calendar/user-time';
import { getGmailCache, resolveTriageRowEmail } from './inbox-sanitize';
import { filterTriageListForMustDo } from './inbox-window';
import { finalizeMustDoList, mustDoHeadline, nonEmpty } from './morning-brief-must-do';
import { roundupToMustDoItems, schoolFromSender, type SchoolRoundup } from './school-roundup';
import { gmailMessageUrlFromEmail } from '@/lib/gmail/message-url';

const PARALLEL_ROLES = [
  'inbox-triage',
  'calendar-reader',
  'health-briefer',
  'news-curator',
  'work-prep',
] as const;

const PARALLEL_AGENTS: Array<{ role: string; domain: string; mission: string }> = [
  {
    role: 'inbox-triage',
    domain: 'inbox',
    mission: 'Triage unread inbox: score urgency, draft replies for high-urgency emails, return urgent[], actionRequired[], fyi[], draftsQueued',
  },
  {
    role: 'calendar-reader',
    domain: 'calendar',
    mission: "Read today and tomorrow calendar, cross-reference children's activities, return todaySchedule[], firstMeeting{}, logisticsFlags[], tomorrowPreview[]",
  },
  {
    role: 'health-briefer',
    domain: 'health',
    mission: "Determine today's workout from schedule, suggest 3 meals, return todayWorkout, estimatedDurationMins, intensity, mealSuggestions[], hydrationGoalLitres, quickNote",
  },
  {
    role: 'news-curator',
    domain: 'news',
    mission: 'Search and filter top 5 relevant headlines across personal topics and current projects, return headlines[{topic, title, url, whyRelevant}]',
  },
  {
    role: 'work-prep',
    domain: 'work',
    mission: 'Find first external meeting, research attendees if unknown, return firstMeeting{}, attendeeContext[], suggestedTalkingPoints[], projectUpdatesNeeded[], prepNotes',
  },
];

async function emitTool(
  tool: string,
  input: Record<string, unknown>,
  agent: HarnessAgent,
  ctx: HarnessContext,
  spawnFn: Parameters<typeof executeHarnessTool>[4],
): Promise<unknown> {
  ctx.send({
    type: 'tool_called',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    agentId: agent.id,
    agentRole: agent.role,
    data: { tool, input },
    timestamp: new Date().toISOString(),
  });

  let result: unknown;
  try {
    result = await executeHarnessTool(tool, input, agent, ctx, spawnFn);
  } catch (err) {
    result = { error: String(err) };
  }

  ctx.send({
    type: 'tool_result',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    agentId: agent.id,
    agentRole: agent.role,
    data: { tool, result },
    timestamp: new Date().toISOString(),
  });

  return result;
}

/** Run Daily OS steps 1–2 deterministically so sub-agents always launch. */
export async function kickstartDailyOrchestrator(
  orchestrator: HarnessAgent,
  ctx: HarnessContext,
  spawnFn: Parameters<typeof executeHarnessTool>[4],
): Promise<void> {
  if (orchestrator.role !== 'daily-orchestrator') return;

  await emitTool(
    'kb_read',
    { keys: ['identity', 'preferences.briefingTime', 'work.currentProjects'] },
    orchestrator,
    ctx,
    spawnFn,
  );

  for (const spawn of PARALLEL_AGENTS) {
    await emitTool('spawn_agent', spawn, orchestrator, ctx, spawnFn);
  }

  ctx.state.data.dailyKickstartComplete = true;
}

function normalizeScheduleItem(item: unknown, restrictToDate: string | null): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const start = String(o.start ?? '');
  const date = String(o.date ?? (start ? eventDateYmd(start) : restrictToDate ?? ''));
  if (restrictToDate && date && date !== restrictToDate) return null;
  return {
    time: String(o.time ?? (start ? start.slice(11, 16) : '')),
    title: String(o.title ?? o.summary ?? 'Event'),
    location: String(o.location ?? ''),
    attendees: Array.isArray(o.attendees) ? o.attendees.map(String) : [],
    notes: String(o.notes ?? ''),
    date,
  };
}

function filterLogisticsForToday(flags: unknown[], schedule: Record<string, unknown>[]): string[] {
  const titles = schedule.map(s => String(s.title ?? '').toLowerCase());
  const hasPeToday = titles.some(t => t.includes('pe'));
  return flags
    .map(f => (typeof f === 'string' ? f : JSON.stringify(f)))
    .filter(flag => {
      const lower = flag.toLowerCase();
      if ((lower.includes(' pe') || lower.includes('pe today') || lower.includes('sports kit')) && !hasPeToday) {
        return false;
      }
      return true;
    });
}

function assembleMorningBrief(ctx: HarnessContext): Record<string, unknown> {
  const tz = String(ctx.state.data.userTimezone ?? resolveUserTimezone(null));
  const todayDate = String(
    ctx.state.data.currentDate ?? userDateYmd(new Date(), tz),
  );
  const inbox = ctx.state.data.inbox_triage as Record<string, unknown> | undefined;
  const calendar = ctx.state.data.calendar_brief as Record<string, unknown> | undefined;
  const health = ctx.state.data.health_brief as Record<string, unknown> | undefined;
  const news = ctx.state.data.news_brief as Record<string, unknown> | undefined;
  const work = ctx.state.data.work_prep as Record<string, unknown> | undefined;
  const gmailCache = getGmailCache(ctx.state.data);

  const urgent = filterTriageListForMustDo(
    (inbox?.urgent as Record<string, unknown>[] | undefined) ?? [],
    gmailCache,
  );
  const actionRequired = (inbox?.actionRequired as unknown[]) ?? [];
  const schoolRoundups = (inbox?.schoolRoundups as unknown[]) ?? [];
  const schoolRollupFallback =
    schoolRoundups.length === 0
      ? actionRequired.filter(
          item => item && typeof item === 'object' && (item as Record<string, unknown>).kind === 'school_roundup',
        )
      : [];
  const actionRows = filterTriageListForMustDo(
    actionRequired.filter(
      item => !(item && typeof item === 'object' && (item as Record<string, unknown>).kind === 'school_roundup'),
    ) as Record<string, unknown>[],
    gmailCache,
  );
  const mustDoSource = [...schoolRoundups, ...schoolRollupFallback, ...urgent, ...actionRows].slice(0, 8);

  const mustDo = mustDoSource.flatMap((item, i) => {
    if (typeof item === 'string') {
      return [{ priority: i + 1, action: item, context: '', source: 'email' }];
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      if (o.school && o.child && Array.isArray(o.needsYou)) {
        const roundup = o as unknown as SchoolRoundup;
        const expanded = roundupToMustDoItems(roundup, i + 1);
        if (expanded.length > 0) return expanded;
      }
      if (o.kind === 'school_roundup' && Array.isArray(o.concerns) && o.concerns.length > 0) {
        const context =
          o.school && o.child ? `${o.school} · ${o.child}` : String(o.from ?? 'School');
        return (o.concerns as Record<string, unknown>[]).map((concern, j) => ({
          priority: i + 1 + j,
          action: String(concern.action ?? concern.subject ?? 'Review'),
          context,
          detail: concern.reason ? String(concern.reason) : undefined,
          source: 'school' as const,
          urgency: concern.tier === 'needs_you' ? 'HIGH' : 'NORMAL',
          messageId: concern.messageId ? String(concern.messageId) : undefined,
          gmailUrl: concern.gmailUrl ? String(concern.gmailUrl) : undefined,
          queueActionId: concern.queueActionId ? String(concern.queueActionId) : undefined,
        }));
      }
      const resolved = resolveTriageRowEmail(o, gmailCache);
      const subject = nonEmpty(o.subject, o.summary, resolved?.subject);
      const from = nonEmpty(o.from, o.context, resolved?.from);
      const snippet = nonEmpty(o.snippet, resolved?.snippet, o.reason);
      const nextStep = nonEmpty(o.action, o.nextStep, o.reason);
      const messageId = resolved?.id ?? nonEmpty(o.messageId);
      const threadId = resolved?.threadId ?? nonEmpty(o.threadId);
      const account = resolved?.account ?? nonEmpty(o.account);
      const school = schoolFromSender(from);
      const action = mustDoHeadline({ subject, action: nextStep, snippet, nextStep });
      const context = nonEmpty(
        school ? `${school.school} · ${school.child}` : '',
        from,
      );
      const detailRaw = nonEmpty(snippet, o.reason);
      const detail = detailRaw && detailRaw !== action ? detailRaw : undefined;
      return [{
        priority: i + 1,
        action,
        subject: subject || undefined,
        context,
        detail,
        source: 'email',
        urgency: String(o.urgency ?? ''),
        queueActionId: o.queueActionId ? String(o.queueActionId) : undefined,
        messageId: messageId || undefined,
        threadId: threadId || undefined,
        account: account || undefined,
        gmailUrl: messageId
          ? gmailMessageUrlFromEmail({ id: messageId, threadId: threadId || undefined, account: account || undefined })
          : undefined,
        snippet: snippet || undefined,
      }];
    }
    return [{ priority: i + 1, action: String(item), context: '', source: 'email' }];
  });
  const mustDoFinal = finalizeMustDoList(mustDo as Record<string, unknown>[]);

  const rawSchedule = (calendar?.todaySchedule as unknown[])
    ?? (calendar?.todayEvents as unknown[])
    ?? (calendar?.events as unknown[])
    ?? [];

  const schedule = rawSchedule
    .map(item => normalizeScheduleItem(item, todayDate))
    .filter((item): item is Record<string, unknown> => item != null);

  const logistics = filterLogisticsForToday(
    (calendar?.logisticsFlags as unknown[]) ?? [],
    schedule,
  );

  const tomorrowPreview = ((calendar?.tomorrowPreview as unknown[]) ?? [])
    .map(item => normalizeScheduleItem(item, ''))
    .filter(Boolean);

  return {
    date: todayDate,
    dayOfWeek: ctx.state.data.dayOfWeek ?? '',
    generatedAt: new Date().toISOString(),
    mustDo: mustDoFinal,
    schedule,
    logistics,
    tomorrowPreview,
    health: health ?? {},
    news: (news?.headlines as unknown[]) ?? [],
    workPrep: work ?? {},
    sources: {
      inbox_triage: inbox != null,
      calendar_brief: calendar != null,
      health_brief: health != null,
      news_brief: news != null,
      work_prep: work != null,
    },
  };
}

/** Steps 3–4 without orchestrator LLM — wait for sub-agents, assemble brief. */
export async function finalizeDailyBrief(
  orchestrator: HarnessAgent,
  ctx: HarnessContext,
  spawnFn: Parameters<typeof executeHarnessTool>[4],
): Promise<void> {
  if (orchestrator.role !== 'daily-orchestrator') return;

  ctx.send({
    type: 'agent_started',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    agentId: orchestrator.id,
    agentRole: orchestrator.role,
    data: { tier: orchestrator.tier, domain: orchestrator.domain, programmatic: true },
    timestamp: new Date().toISOString(),
  });

  const waitResult = await emitTool(
    'wait_for_agents',
    { roles: [...PARALLEL_ROLES], timeoutMs: 300_000 },
    orchestrator,
    ctx,
    spawnFn,
  ) as { status?: string; roles?: string[]; failed?: string[] };

  const brief = assembleMorningBrief(ctx);
  const failedAgents = waitResult?.failed ?? PARALLEL_ROLES.filter(role => {
    const agent = getAgentByRole(ctx.registry, role);
    return agent?.status === 'error';
  });

  if (waitResult?.status === 'timeout') {
    brief.partial = true;
    brief.note = 'Some sub-agents did not finish in time — brief assembled from available data';
  } else if (waitResult?.status === 'partial' || failedAgents.length > 0) {
    brief.partial = true;
    brief.agentErrors = failedAgents;
    const failedLabels = failedAgents.map(role => role.replace(/-/g, ' ')).join(', ');
    brief.note = failedAgents.includes('news-curator')
      ? `News step unavailable (${failedLabels}) — brief assembled without headlines`
      : `Some sections unavailable (${failedLabels}) — brief assembled from available data`;
  }

  await emitTool(
    'write_state',
    { key: 'morning_brief', value: brief },
    orchestrator,
    ctx,
    spawnFn,
  );

  setAgentStatus(ctx.registry, orchestrator.id, 'complete');

  ctx.send({
    type: 'agent_complete',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    agentId: orchestrator.id,
    agentRole: orchestrator.role,
    data: {
      tier: orchestrator.tier,
      stateWriteKey: 'morning_brief',
      summary: `Morning brief assembled (${mustDoCount(brief)} priorities)`,
      structured: brief,
    },
    timestamp: new Date().toISOString(),
  });
}

function mustDoCount(brief: Record<string, unknown>): number {
  return Array.isArray(brief.mustDo) ? brief.mustDo.length : 0;
}
