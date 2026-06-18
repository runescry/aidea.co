import type { EntityConfig } from '@/lib/harness/types';

export const companyEntityConfig: EntityConfig = {
  type: 'company',
  name: 'Company Startup Simulation',
  mission: 'Take a startup idea from concept to launch-ready with real deliverables: strategy, product plan, marketing, engineering architecture, financial model, copy, outreach, pricing page, and customer research.',
  rootAgentId: 'ceo',
  agentIds: ['ceo', 'cpo', 'cmo', 'cto', 'cfo', 'copywriter', 'outreach', 'pricing', 'research'],
  availableTools: [
    'spawn_agent',
    'wait_for_agents',
    'write_state',
    'read_state',
    'request_consensus',
    'send_message',
  ],
  autonomy: 'full-auto',
  consensusThreshold: 0.66,
  costConfig: {
    maxTokensPerRun: 150_000,
    maxAgentsPerRun: 20,
    maxTierDepth: 3,
    realWorldToolMode: 'dry-run',
  },
  buildInitialContext: (input) => ({
    idea: input.idea ?? '',
  }),
  buildInitialTask: (input) => ({
    description: `You are founding a new company. The idea is: "${input.idea ?? ''}". Build it out completely — from identity through to launch deliverables.`,
    contextKeys: [],
  }),
};
