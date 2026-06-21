import type { EntityConfig, EntityInput } from '@/lib/harness/types';
import { userDateContext, resolveUserTimezone } from '@/lib/calendar/user-time';
import type { KnowledgeBase } from '@/types/knowledge-base';

export type DailyMode = 'full' | 'lite';

export function isDailyLiteMode(input: EntityInput = {}): boolean {
  return input.mode === 'lite' || input.lite === true;
}

export function resolveDailyEntityConfig(input: EntityInput = {}): EntityConfig {
  return isDailyLiteMode(input) ? dailyLiteEntityConfig : dailyEntityConfig;
}

function dailyContextFromInput(input: EntityInput) {
  const kb = input.kb as Pick<KnowledgeBase, 'identity'> | undefined;
  const tz = typeof input.timezone === 'string' ? input.timezone : resolveUserTimezone(kb);
  const now = input.now instanceof Date ? input.now : new Date();
  const ctx = userDateContext(now, tz);
  return {
    ...ctx,
    ...(typeof input.command === 'string' ? { command: input.command } : {}),
    ...(input.history ? { conversationHistory: input.history } : {}),
  };
}

const dailyContext = (input: EntityInput) => dailyContextFromInput(input);

const dailyTask = (input: EntityInput) => {
  const kb = input.kb as Pick<KnowledgeBase, 'identity'> | undefined;
  const tz = typeof input.timezone === 'string' ? input.timezone : resolveUserTimezone(kb);
  const now = input.now instanceof Date ? input.now : new Date();
  const label = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  return {
    description: `Today is ${label}. Produce the morning brief.`,
    contextKeys: [] as string[],
  };
};

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
  buildInitialContext: dailyContextFromInput,
  buildInitialTask: (input) => {
    let description = `Execute this command: "${input.command ?? ''}"`;
    if (typeof input.rejectionMemory === 'string' && input.rejectionMemory.trim()) {
      description += `\n\n${input.rejectionMemory.trim()}`;
    }
    return { description, contextKeys: [] };
  },
};
