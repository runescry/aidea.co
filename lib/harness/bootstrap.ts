import type { EntityConfig, EntityInput, HarnessContext, EntityState, SenderFn } from './types';
import { DEFAULT_COST_CONFIG } from './types';
import { createRegistry, registerAgent } from './registry';
import { createEntityState, persistEntityState } from './state';
import { createMessageBus } from './bus';
import { createCostTracker } from './cost';
import { buildHarnessAgent } from './spawn';
import { runAgentLoop } from './executor';
import { loadAgentOverrides, resolveLibraryAgent } from '@/lib/agents/resolve';
import { hasNangoConnections } from '@/lib/nango/connections';

export async function bootstrapEntity(
  config: EntityConfig,
  input: EntityInput,
  send: SenderFn,
  sessionId: string
): Promise<EntityState> {
  const entityId = crypto.randomUUID();

  // ── Build initial state ─────────────────────────────────────────────────────
  const initialData = config.buildInitialContext(input);
  const state = createEntityState(entityId, config.type, config.name, initialData);
  if (!config.deferStatePersist) {
    await persistEntityState(state);
  }

  // ── Build registry & infrastructure ────────────────────────────────────────
  const registry = createRegistry(entityId);
  const bus = createMessageBus();

  const [nangoConnected, agentOverrides] = await Promise.all([
    hasNangoConnections(),
    loadAgentOverrides(),
  ]);

  let realWorldMode =
    config.costConfig?.realWorldToolMode ?? DEFAULT_COST_CONFIG.realWorldToolMode;
  if (realWorldMode === 'dry-run' && nangoConnected) {
    realWorldMode = 'auto';
  }

  const effectiveConfig: EntityConfig = {
    ...config,
    costConfig: {
      ...DEFAULT_COST_CONFIG,
      ...config.costConfig,
      realWorldToolMode: realWorldMode,
    },
  };

  const cost = createCostTracker(effectiveConfig.costConfig!, realWorldMode);

  const ctx: HarnessContext = {
    entityId,
    sessionId,
    config: effectiveConfig,
    registry,
    state,
    cost,
    bus,
    send,
    agentOverrides,
  };

  send({
    type: 'entity_started',
    sessionId,
    entityId,
    data: {
      entityType: config.type,
      entityName: config.name,
      mission: config.mission,
      inputKeys: Object.keys(input),
    },
    timestamp: new Date().toISOString(),
  });

  // ── Spawn root agent ────────────────────────────────────────────────────────
  const rootDef = resolveLibraryAgent(config.rootAgentId, agentOverrides);
  const taskSpec = config.buildInitialTask(input);
  const rootAgent = buildHarnessAgent(rootDef, entityId, null, 0, taskSpec.description);
  rootAgent.stateReadKeys = [...rootDef.stateReadKeys, ...taskSpec.contextKeys];

  registry.root = rootAgent.id;
  registerAgent(registry, rootAgent);
  cost.recordAgent();

  send({
    type: 'agent_spawned',
    sessionId,
    entityId,
    agentId: rootAgent.id,
    agentRole: rootAgent.role,
    data: { tier: 0, domain: 'executive', parentId: null },
    timestamp: new Date().toISOString(),
  });

  // ── Run entity ──────────────────────────────────────────────────────────────
  try {
    await runAgentLoop(rootAgent, ctx);

    // Wait for all spawned agents to complete
    await waitForAllAgents(registry, ctx);

    state.status = 'complete';
    await persistEntityState(state);

    send({
      type: 'entity_complete',
      sessionId,
      entityId,
      data: { cost: cost.snapshot() },
      timestamp: new Date().toISOString(),
    });

    return state;

  } catch (err) {
    state.status = 'error';
    await persistEntityState(state);

    send({
      type: 'entity_error',
      sessionId,
      entityId,
      data: { error: String(err), cost: cost.snapshot() },
      timestamp: new Date().toISOString(),
    });

    throw err;
  }
}

async function waitForAllAgents(
  registry: import('./types').AgentRegistry,
  ctx: HarnessContext,
  timeoutMs = 300_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const allDone = [...registry.agents.values()].every(
      a => a.status === 'complete' || a.status === 'error'
    );
    if (allDone) return;
    await new Promise(r => setTimeout(r, 1000));
  }

  // Mark remaining agents as errored
  for (const [id, agent] of registry.agents) {
    if (agent.status === 'running' || agent.status === 'idle' || agent.status === 'waiting') {
      ctx.send({
        type: 'agent_error',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: id,
        agentRole: agent.role,
        data: { error: 'Agent timed out waiting for entity completion' },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
