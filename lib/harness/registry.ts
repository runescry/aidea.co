import type { HarnessAgent, AgentRegistry, AgentStatus } from './types';

export function createRegistry(entityId: string): AgentRegistry {
  return {
    entityId,
    agents: new Map(),
    root: '',
    tierMap: new Map(),
    roleMap: new Map(),
  };
}

export function registerAgent(registry: AgentRegistry, agent: HarnessAgent): void {
  registry.agents.set(agent.id, agent);

  const tier = registry.tierMap.get(agent.tier) ?? [];
  if (!tier.includes(agent.id)) tier.push(agent.id);
  registry.tierMap.set(agent.tier, tier);

  registry.roleMap.set(agent.role, agent.id);
}

export function getAgent(registry: AgentRegistry, id: string): HarnessAgent {
  const agent = registry.agents.get(id);
  if (!agent) throw new Error(`Agent ${id} not found in registry`);
  return agent;
}

export function getAgentByRole(registry: AgentRegistry, role: string): HarnessAgent | undefined {
  const id = registry.roleMap.get(role);
  return id ? registry.agents.get(id) : undefined;
}

export function getAgentsByTier(registry: AgentRegistry, tier: number): HarnessAgent[] {
  return (registry.tierMap.get(tier) ?? [])
    .map(id => registry.agents.get(id))
    .filter((a): a is HarnessAgent => !!a);
}

export function getChildren(registry: AgentRegistry, parentId: string): HarnessAgent[] {
  return [...registry.agents.values()].filter(a => a.parentId === parentId);
}

export function patchAgent(
  registry: AgentRegistry,
  id: string,
  patch: Partial<HarnessAgent>
): HarnessAgent {
  const existing = getAgent(registry, id);
  const updated = { ...existing, ...patch };
  registry.agents.set(id, updated);
  return updated;
}

export function setAgentStatus(
  registry: AgentRegistry,
  id: string,
  status: AgentStatus
): void {
  patchAgent(registry, id, {
    status,
    ...(status === 'complete' || status === 'error'
      ? { completedAt: new Date().toISOString() }
      : {}),
  });
}

export function addChildId(registry: AgentRegistry, parentId: string, childId: string): void {
  const parent = getAgent(registry, parentId);
  if (!parent.childIds.includes(childId)) {
    patchAgent(registry, parentId, { childIds: [...parent.childIds, childId] });
  }
}

export function allAgentsInStatus(
  registry: AgentRegistry,
  ids: string[],
  status: AgentStatus
): boolean {
  return ids.every(id => registry.agents.get(id)?.status === status);
}

// Returns all tier-N agent IDs whose parent is the given agent
export function getChildIds(registry: AgentRegistry, parentId: string): string[] {
  return getChildren(registry, parentId).map(a => a.id);
}
