import type { EntityConfig } from '@/lib/harness/types';

// Stub — full agent library for learning entity to be built in next phase
export const learningEntityConfig: EntityConfig = {
  type: 'learning',
  name: 'Learning OS',
  mission: 'Design a personalised curriculum and produce a concrete learning plan with resources, practice schedule, and knowledge synthesis framework.',
  rootAgentId: 'life-ceo',   // reuses life-ceo as root until learning-ceo is built
  agentIds: ['life-ceo', 'growth-director', 'shared-researcher', 'shared-planner'],
  availableTools: ['spawn_agent', 'wait_for_agents', 'write_state', 'read_state', 'send_message'],
  autonomy: 'semi-auto',
  consensusThreshold: 0.70,
  costConfig: {
    maxTokensPerRun: 80_000,
    maxAgentsPerRun: 10,
    maxTierDepth: 2,
    realWorldToolMode: 'dry-run',
  },
  buildInitialContext: (input) => ({
    learningGoal: input.goal ?? input.prompt ?? '',
    currentSkillLevel: input.skillLevel ?? 'beginner',
    availableHoursPerWeek: input.hoursPerWeek ?? 5,
    timeframe: input.timeframe ?? '3 months',
  }),
  buildInitialTask: (input) => ({
    description: `Design a complete learning plan for: "${input.goal ?? input.prompt ?? ''}". Current level: ${input.skillLevel ?? 'beginner'}. Available: ${input.hoursPerWeek ?? 5} hours/week for ${input.timeframe ?? '3 months'}.`,
    contextKeys: [],
  }),
};
