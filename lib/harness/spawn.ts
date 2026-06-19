import type { HarnessAgent, HarnessContext, AgentDefinition, Authority } from './types';
import { registerAgent, addChildId, patchAgent } from './registry';
import { AGENT_LIBRARY } from '@/lib/agents/library';
import { resolveLibraryAgent } from '@/lib/agents/resolve';

export function buildHarnessAgent(
  def: AgentDefinition,
  entityId: string,
  parentId: string | null,
  tier: number,
  missionOverride?: string,
  authorityOverride?: Authority
): HarnessAgent {
  return {
    id: crypto.randomUUID(),
    definitionId: def.id,
    role: def.id,
    entityId,
    parentId,
    childIds: [],
    peerIds: [],
    tier,
    domain: def.archetype,
    authority: authorityOverride ?? def.authority,
    model: def.defaultModel,
    allowedTools: def.defaultTools,
    systemPrompt: missionOverride
      ? `${def.systemPrompt}\n\n---\nYOUR SPECIFIC MISSION: ${missionOverride}`
      : def.systemPrompt,
    stateReadKeys: def.stateReadKeys,
    stateWriteKey: def.stateWriteKey,
    maxTokens: def.maxTokens,
    useThinking: def.useThinking,
    thinkingBudget: def.thinkingBudget,
    memory: { crossRunContext: '', priorOutputs: [] },
    status: 'idle',
    spawnedAt: new Date().toISOString(),
    tokensUsed: 0,
  };
}

// Called by the tools layer when spawn_agent tool is invoked
export function spawnChildAgent(
  role: string,
  domain: string,
  mission: string,
  authorityStr: string,
  parentAgent: HarnessAgent,
  ctx: HarnessContext,
  runLoop: (agent: HarnessAgent, ctx: HarnessContext) => Promise<void>
): HarnessAgent {
  const def = AGENT_LIBRARY[role]
    ? resolveLibraryAgent(role, ctx.agentOverrides ?? {})
    : null;
  if (!def) {
    // Dynamically create a definition for unknown roles using shared researcher pattern
    const fallbackDef: AgentDefinition = {
      id: role,
      archetype: 'execution',
      displayName: role,
      defaultModel: 'claude-sonnet-4-6',
      authority: (authorityStr as Authority) ?? 'executor',
      defaultTools: ['write_state', 'read_state', 'send_message'],
      stateReadKeys: [],
      stateWriteKey: `${role}_output`,
      spawnPatterns: [],
      systemPrompt: `You are ${role} (domain: ${domain}). Execute your mission completely.`,
    };
    return spawnFromDef(fallbackDef, domain, mission, authorityStr, parentAgent, ctx, runLoop);
  }

  return spawnFromDef(def, domain, mission, authorityStr, parentAgent, ctx, runLoop);
}

function spawnFromDef(
  def: AgentDefinition,
  domain: string,
  mission: string,
  authorityStr: string,
  parentAgent: HarnessAgent,
  ctx: HarnessContext,
  runLoop: (agent: HarnessAgent, ctx: HarnessContext) => Promise<void>
): HarnessAgent {
  const child = buildHarnessAgent(
    { ...def, archetype: domain as import('./types').ArchetypeId || def.archetype },
    ctx.entityId,
    parentAgent.id,
    parentAgent.tier + 1,
    mission,
    (authorityStr as Authority) ?? def.authority
  );

  registerAgent(ctx.registry, child);
  addChildId(ctx.registry, parentAgent.id, child.id);
  ctx.cost.recordAgent();

  // Wire peer IDs for siblings
  const siblings = ctx.registry.tierMap.get(child.tier) ?? [];
  for (const sibId of siblings) {
    if (sibId === child.id) continue;
    const sib = ctx.registry.agents.get(sibId);
    if (sib && sib.parentId === parentAgent.id) {
      patchAgent(ctx.registry, sibId, { peerIds: [...sib.peerIds, child.id] });
      patchAgent(ctx.registry, child.id, { peerIds: [...(ctx.registry.agents.get(child.id)?.peerIds ?? []), sibId] });
    }
  }

  // Start loop in background (non-blocking)
  setImmediate(() => {
    runLoop(child, ctx).catch(err => {
      ctx.send({
        type: 'agent_error',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: child.id,
        agentRole: child.role,
        data: { error: String(err) },
        timestamp: new Date().toISOString(),
      });
    });
  });

  return child;
}
