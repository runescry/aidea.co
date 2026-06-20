import type { EntityConfig } from '@/lib/harness/types';

export const creatorEntityConfig: EntityConfig = {
  type: 'creator',
  name: 'Creator Studio',
  mission: 'Build a content strategy, production workflow, and distribution plan for a creator building an audience and monetising their work.',
  rootAgentId: 'creator-ceo',
  agentIds: [
    'creator-ceo',
    'content-director',
    'production-director',
    'distribution-director',
    'shared-researcher',
    'copywriter',
  ],
  availableTools: ['spawn_agent', 'wait_for_agents', 'write_state', 'read_state', 'send_message', 'kb_read', 'web_search'],
  autonomy: 'semi-auto',
  consensusThreshold: 0.66,
  costConfig: {
    maxTokensPerRun: 80_000,
    maxAgentsPerRun: 10,
    maxTierDepth: 2,
    realWorldToolMode: 'dry-run',
  },
  buildInitialContext: (input) => ({
    creatorPrompt: input.prompt ?? '',
    platform: input.platform ?? 'multi-platform',
    niche: input.niche ?? '',
    currentAudience: input.audience ?? '0',
    monetisationGoal: input.monetisationGoal ?? '',
  }),
  buildInitialTask: (input) => ({
    description: `You are building a creator business. Context: "${input.prompt ?? ''}". Platform: ${input.platform ?? 'multi-platform'}. Niche: ${input.niche ?? 'TBD'}. Audience: ${input.audience ?? '0'}. Monetisation goal: ${input.monetisationGoal ?? 'TBD'}. Produce a complete creator strategy and content plan.`,
    contextKeys: [],
  }),
};
