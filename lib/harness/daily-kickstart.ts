import type { HarnessAgent, HarnessContext } from './types';
import { executeHarnessTool } from './tools';

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
