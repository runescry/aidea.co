import type { EntityConfig, EntityInput } from '@/lib/harness/types';

export type DailyMode = 'full' | 'lite';

export function isDailyLiteMode(input: EntityInput = {}): boolean {
  return input.mode === 'lite' || input.lite === true;
}

export function resolveDailyEntityConfig(input: EntityInput = {}): EntityConfig {
  return isDailyLiteMode(input) ? dailyLiteEntityConfig : dailyEntityConfig;
}

const dailyContext = (_input: EntityInput) => ({
  currentDate: new Date().toISOString().split('T')[0],
  currentTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  dayOfWeek: new Date().toLocaleDateString('en-GB', { weekday: 'long' }),
});

const dailyTask = (_input: EntityInput) => ({
  description: `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Produce the morning brief.`,
  contextKeys: [] as string[],
});

export const dailyLiteEntityConfig: EntityConfig = {
  type: 'daily',
  name: 'Daily OS (lite)',
  mission: 'Produce a scannable morning brief in one agent pass — inbox, calendar, health, news, and work prep without parallel sub-agents.',
  rootAgentId: 'daily-lite-briefer',
  agentIds: ['daily-lite-briefer'],
  availableTools: [
    'write_state',
    'read_state',
    'kb_read',
    'gmail_read',
    'calendar_read',
    'news_search',
  ],
  autonomy: 'semi-auto',
  consensusThreshold: 0.60,
  costConfig: {
    maxTokensPerRun: 20_000,
    maxAgentsPerRun: 1,
    maxTierDepth: 1,
    realWorldToolMode: 'dry-run',
  },
  buildInitialContext: dailyContext,
  buildInitialTask: dailyTask,
};

export const dailyEntityConfig: EntityConfig = {
  type: 'daily',
  name: 'Daily OS',
  mission: 'Produce a complete morning brief covering inbox, calendar, health, news, and work prep — then stay available to action commands throughout the day.',
  rootAgentId: 'daily-orchestrator',
  agentIds: [
    'daily-orchestrator',
    'inbox-triage',
    'calendar-reader',
    'health-briefer',
    'news-curator',
    'work-prep',
  ],
  availableTools: [
    'spawn_agent',
    'wait_for_agents',
    'write_state',
    'read_state',
    'kb_read',
    'kb_write',
    'update_kb',
    'queue_action',
    'gmail_read',
    'calendar_read',
    'contacts_read',
    'news_search',
    'web_search',
    'web_fetch',
    'document_parse',
    'send_message',
    'request_human_input',
  ],
  autonomy: 'semi-auto',
  consensusThreshold: 0.60,
  costConfig: {
    maxTokensPerRun: 80_000,
    maxAgentsPerRun: 10,
    maxTierDepth: 2,
    realWorldToolMode: 'dry-run',
  },
  buildInitialContext: dailyContext,
  buildInitialTask: dailyTask,
};

export const dispatchEntityConfig: EntityConfig = {
  type: 'daily',
  name: 'Dispatch',
  mission: 'Execute the user command as efficiently as possible.',
  rootAgentId: 'dispatcher',
  agentIds: [
    'dispatcher',
    'inbox-triage',
    'calendar-reader',
    'shared-researcher',
  ],
  availableTools: [
    'spawn_agent',
    'wait_for_agents',
    'write_state',
    'read_state',
    'kb_read',
    'kb_write',
    'update_kb',
    'queue_action',
    'gmail_read',
    'calendar_read',
    'web_search',
    'news_search',
    'web_fetch',
    'send_message',
    'request_human_input',
  ],
  autonomy: 'semi-auto',
  consensusThreshold: 0.60,
  costConfig: {
    maxTokensPerRun: 30_000,
    maxAgentsPerRun: 4,
    maxTierDepth: 2,
    realWorldToolMode: 'dry-run',
  },
  deferStatePersist: true,
  buildInitialContext: (input) => ({
    command: input.command ?? '',
    conversationHistory: input.history ?? [],
    currentDate: new Date().toISOString().split('T')[0],
    currentTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }),
  buildInitialTask: (input) => ({
    description: `Execute this command: "${input.command ?? ''}"`,
    contextKeys: [],
  }),
};
