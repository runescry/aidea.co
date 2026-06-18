import type { EntityConfig } from '@/lib/harness/types';

export const personalEntityConfig: EntityConfig = {
  type: 'personal',
  name: 'Personal Life OS',
  mission: 'Produce a clear, integrated personal operating plan covering health, finance, relationships, growth, and daily systems — with concrete next actions across all domains.',
  rootAgentId: 'life-ceo',
  agentIds: [
    'life-ceo',
    'growth-director',
    'health-director',
    'finance-director',
    'relationships-director',
    'systems-director',
    'shared-researcher',
    'shared-planner',
  ],
  availableTools: [
    'spawn_agent',
    'wait_for_agents',
    'write_state',
    'read_state',
    'request_consensus',
    'send_message',
  ],
  autonomy: 'supervised',          // personal entity pauses for real-world actions
  consensusThreshold: 0.70,        // higher bar — life decisions need stronger agreement
  costConfig: {
    maxTokensPerRun: 100_000,
    maxAgentsPerRun: 15,
    maxTierDepth: 3,
    realWorldToolMode: 'require-approval', // calendar/gmail need human approval
  },
  buildInitialContext: (input) => ({
    userPrompt: input.prompt ?? input.goals ?? '',
    currentDate: new Date().toISOString().split('T')[0],
  }),
  buildInitialTask: (input) => ({
    description: `You are the CEO of this person's life. Here is their situation and what they want to work on:\n\n"${input.prompt ?? input.goals ?? ''}"\n\nProduce a complete personal OS plan across health, finance, relationships, growth, and systems.`,
    contextKeys: [],
  }),
};
