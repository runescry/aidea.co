import { AGENT_LIBRARY } from '@/lib/agents/library';
import { loadAgentOverrides } from '@/lib/agents/resolve';
import { hasApiKey } from '@/lib/ai/provider';
import { bootstrapEntity } from '@/lib/harness/bootstrap';
import { formatDispatchChatSummary } from '@/lib/harness/dispatch-summary';
import type { CostSnapshot, EntityConfig, EntityState, HarnessEvent } from '@/lib/harness/types';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { validateAgentHarnessRun, type AgentHarnessValidation } from './agent-harness-validate';
import { runInEvalHarnessContext } from './eval-context';
import {
  extractToolCallsFromEvents,
  responseTextFromEvents,
  toolsCalledFromEvents,
} from './harness-events';

export interface RunAgentHarnessOptions {
  agentId: string;
  mission: string;
  realWorldMode?: 'auto' | 'dry-run';
  applyOverrides?: boolean;
  kbFixture?: Partial<KnowledgeBase> | Record<string, unknown>;
  sessionId?: string;
}

export interface AgentHarnessResult {
  sessionId: string;
  agentId: string;
  mode: 'harness';
  realWorldMode: 'auto' | 'dry-run';
  response: string;
  structured: unknown;
  stateWriteKey: string;
  toolsCalled: string[];
  toolCalls: ReturnType<typeof extractToolCallsFromEvents>;
  validation: AgentHarnessValidation;
  cost: Partial<CostSnapshot>;
  state: EntityState;
  events: HarnessEvent[];
}

function buildEvalEntityConfig(
  agentId: string,
  mission: string,
  realWorldMode: 'auto' | 'dry-run',
): EntityConfig {
  const def = AGENT_LIBRARY[agentId];
  if (!def) throw new Error(`Unknown agentId: ${agentId}`);

  return {
    type: 'custom',
    name: def.displayName,
    mission,
    rootAgentId: agentId,
    agentIds: [agentId],
    availableTools: def.defaultTools,
    autonomy: 'semi-auto',
    consensusThreshold: 0.6,
    costConfig: {
      maxTokensPerRun: 30_000,
      maxAgentsPerRun: 1,
      maxTierDepth: 1,
      realWorldToolMode: realWorldMode,
      agentTimeoutMs: 90_000,
      runTimeoutMs: 120_000,
    },
    deferStatePersist: true,
    buildInitialContext: (input) => {
      const fixture = input.kbFixture as Record<string, unknown> | undefined;
      if (!fixture) return {};
      return {
        life_context: fixture.life_context ?? fixture.identity ?? {},
        ...fixture,
      };
    },
    buildInitialTask: () => ({
      description: mission,
      contextKeys: def.stateReadKeys,
    }),
  };
}

function costFromEvents(events: HarnessEvent[]): Partial<CostSnapshot> {
  const complete = [...events].reverse().find(e => e.type === 'entity_complete');
  const cost = (complete?.data as { cost?: CostSnapshot } | undefined)?.cost;
  return cost ?? { estimatedUSD: 0, agentCount: 1 };
}

/** Run a single library agent through bootstrap + tools (eval isolation). */
export async function runAgentHarness(
  options: RunAgentHarnessOptions,
): Promise<AgentHarnessResult> {
  if (!hasApiKey()) {
    throw new Error('LLM not configured — set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY');
  }

  const agentId = options.agentId.trim();
  const mission = options.mission.trim();
  const def = AGENT_LIBRARY[agentId];
  if (!def) throw new Error(`Unknown agentId: ${agentId}`);
  if (!mission) throw new Error('mission is required');

  const realWorldMode = options.realWorldMode ?? 'dry-run';
  const sessionId = options.sessionId ?? crypto.randomUUID();
  const applyOverrides = options.applyOverrides ?? false;
  const agentOverrides = applyOverrides ? await loadAgentOverrides() : {};

  return runInEvalHarnessContext(
    {
      kbFixture: options.kbFixture,
      skipQueueWrites: true,
      skipPersist: true,
    },
    async () => {
      const events: HarnessEvent[] = [];
      const send = (event: HarnessEvent) => events.push(event);
      const config = buildEvalEntityConfig(agentId, mission, realWorldMode);

      const state = await bootstrapEntity(
        config,
        { kbFixture: options.kbFixture },
        send,
        sessionId,
        { realWorldMode, agentOverrides },
      );

      const structured = def.stateWriteKey ? state.data[def.stateWriteKey] : undefined;
      const validation = validateAgentHarnessRun(agentId, events, structured, state.data);
      const toolCalls = extractToolCallsFromEvents(events);
      const response = responseTextFromEvents(events, structured, formatDispatchChatSummary);

      return {
        sessionId,
        agentId,
        mode: 'harness',
        realWorldMode,
        response,
        structured: structured ?? {},
        stateWriteKey: def.stateWriteKey,
        toolsCalled: toolsCalledFromEvents(events),
        toolCalls,
        validation,
        cost: costFromEvents(events),
        state,
        events,
      };
    },
  );
}
