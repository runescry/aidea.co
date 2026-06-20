import type { HarnessAgent, HarnessContext } from './types';
import { getAgentByRole, setAgentStatus } from './registry';
import { setStateKey } from './state';
import { executeHarnessTool } from './tools';

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

function assembleMorningBrief(ctx: HarnessContext): Record<string, unknown> {
  const inbox = ctx.state.data.inbox_triage as Record<string, unknown> | undefined;
  const calendar = ctx.state.data.calendar_brief as Record<string, unknown> | undefined;
  const health = ctx.state.data.health_brief as Record<string, unknown> | undefined;
  const news = ctx.state.data.news_brief as Record<string, unknown> | undefined;
  const work = ctx.state.data.work_prep as Record<string, unknown> | undefined;

  const urgent = (inbox?.urgent as unknown[]) ?? (inbox?.actionRequired as unknown[]) ?? [];
  const mustDo = urgent.slice(0, 5).map((item, i) => {
    if (typeof item === 'string') {
      return { priority: i + 1, action: item, context: '', source: 'email' };
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      return {
        priority: i + 1,
        action: String(o.summary ?? o.subject ?? o.action ?? 'Review item'),
        context: String(o.from ?? o.context ?? ''),
        source: 'email',
      };
    }
    return { priority: i + 1, action: String(item), context: '', source: 'email' };
  });

  const schedule = (calendar?.todaySchedule as unknown[])
    ?? (calendar?.events as unknown[])
    ?? [];

  const logistics = (calendar?.logisticsFlags as unknown[]) ?? [];

  return {
    date: ctx.state.data.currentDate ?? new Date().toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    mustDo,
    schedule,
    logistics: logistics.map(l => (typeof l === 'string' ? l : JSON.stringify(l))),
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
  ) as { status?: string; roles?: string[] };

  const brief = assembleMorningBrief(ctx);
  if (waitResult?.status === 'timeout') {
    brief.partial = true;
    brief.note = 'Some sub-agents did not finish in time — brief assembled from available data';
  }

  const failedAgents = PARALLEL_ROLES.filter(role => {
    const agent = getAgentByRole(ctx.registry, role);
    return agent?.status === 'error';
  });
  if (failedAgents.length > 0) {
    brief.agentErrors = failedAgents;
    brief.note = `Sub-agents failed (${failedAgents.join(', ')}) — check AI API keys in Vercel settings`;
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
