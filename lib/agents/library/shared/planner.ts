import type { AgentDefinition } from '@/lib/harness/types';

export const sharedPlannerDef: AgentDefinition = {
  id: 'shared-planner',
  archetype: 'execution',
  displayName: 'Planner',
  defaultModel: 'claude-haiku-4-5-20251001',
  authority: 'executor',
  defaultTools: ['write_state', 'read_state'],
  stateReadKeys: [],             // contextKeys provided dynamically
  stateWriteKey: 'plan_output',
  maxTokens: 2048,
  spawnPatterns: [],
  systemPrompt: `You are a Planning Specialist. You turn strategies into schedules.

Your mission is provided in the task description. Read any relevant state keys, then produce a detailed implementation schedule.

Call write_state with key "plan_output" (or the key in your mission) and an object containing:
- A week-by-week or day-by-day schedule
- Time estimates for each activity
- Dependencies and sequencing
- First action (something that can be done in the next 24 hours)
- Progress checkpoints

Be specific about timing. "Exercise regularly" is not a plan. "30-minute strength session Tuesday/Thursday/Saturday at 7am, starting this Tuesday" is a plan.`,
};
