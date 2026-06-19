import type { AgentDefinition } from '@/lib/harness/types';
import type { AgentOverride, AgentOverridesMap } from '@/types/agent-overrides';
import { AGENT_LIBRARY } from '@/lib/agents/library';
import { readProfile } from '@/lib/storage';

export function applyAgentOverride(
  base: AgentDefinition,
  override?: AgentOverride | null,
): AgentDefinition {
  if (!override) return base;

  const promptAppend = override.promptAppend?.trim();
  const systemPrompt = promptAppend
    ? `${base.systemPrompt}\n\n---\nCUSTOM INSTRUCTIONS:\n${promptAppend}`
    : base.systemPrompt;

  return {
    ...base,
    displayName: override.displayName?.trim() || base.displayName,
    defaultTools: override.tools?.length ? override.tools : base.defaultTools,
    systemPrompt,
  };
}

export function mergeOverride(
  current: AgentOverride | undefined,
  updates: Partial<AgentOverride>,
): AgentOverride {
  const next: AgentOverride = { ...current, ...updates, updatedAt: new Date().toISOString() };
  if (updates.tools !== undefined) next.tools = updates.tools;
  if (updates.promptAppend === '') delete next.promptAppend;
  if (updates.displayName === '') delete next.displayName;
  return next;
}

export async function loadAgentOverrides(): Promise<AgentOverridesMap> {
  const profile = await readProfile();
  return (profile.agentOverrides as AgentOverridesMap | undefined) ?? {};
}

export function resolveLibraryAgent(id: string, overrides: AgentOverridesMap): AgentDefinition {
  const base = AGENT_LIBRARY[id];
  if (!base) throw new Error(`Agent '${id}' not found in agent library`);
  return applyAgentOverride(base, overrides[id]);
}
