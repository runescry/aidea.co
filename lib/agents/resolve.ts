import type { AgentDefinition } from '@/lib/harness/types';
import type { AgentOverride, AgentOverridesMap } from '@/types/agent-overrides';
import { AGENT_LIBRARY } from '@/lib/agents/library';
import { readProfile } from '@/lib/storage';

let _overridesCache: { at: number; data: AgentOverridesMap } | null = null;
const OVERRIDE_CACHE_MS = 30_000;

function toolsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((t, i) => t === sb[i]);
}

export function isOverrideEmpty(override: AgentOverride): boolean {
  return (
    !override.displayName?.trim()
    && !override.systemPromptReplace?.trim()
    && !override.promptAppend?.trim()
    && override.tools === undefined
  );
}

export function hasActiveCustomization(
  base: AgentDefinition,
  override?: AgentOverride | null,
): boolean {
  if (!override) return false;
  if (override.displayName?.trim()) return true;
  if (override.systemPromptReplace?.trim()) return true;
  if (override.promptAppend?.trim()) return true;
  if (override.tools !== undefined && !toolsEqual(override.tools, base.defaultTools)) return true;
  return false;
}

export function buildEffectiveSystemPrompt(
  base: AgentDefinition,
  override?: AgentOverride | null,
): string {
  const name = override?.displayName?.trim() || base.displayName;
  let prompt = override?.systemPromptReplace?.trim() || base.systemPrompt;

  const append = override?.promptAppend?.trim();
  if (append) {
    prompt += `\n\n---\nCUSTOM INSTRUCTIONS:\n${append}`;
  }

  return `You are ${name} (role: ${base.id}).\n\n${prompt}`;
}

export function applyAgentOverride(
  base: AgentDefinition,
  override?: AgentOverride | null,
): AgentDefinition {
  if (!override || isOverrideEmpty(override)) return base;

  const tools =
    override.tools !== undefined ? override.tools : base.defaultTools;

  return {
    ...base,
    displayName: override.displayName?.trim() || base.displayName,
    defaultTools: tools,
    systemPrompt: buildEffectiveSystemPrompt(base, override),
  };
}

export function mergeOverride(
  current: AgentOverride | undefined,
  updates: Partial<AgentOverride>,
): AgentOverride {
  const next: AgentOverride = { ...current, ...updates, updatedAt: new Date().toISOString() };

  if (updates.displayName === '') delete next.displayName;
  if (updates.promptAppend === '') delete next.promptAppend;
  if (updates.systemPromptReplace === '') delete next.systemPromptReplace;
  if (updates.tools !== undefined) next.tools = updates.tools;

  return next;
}

export async function loadAgentOverrides(): Promise<AgentOverridesMap> {
  const now = Date.now();
  if (_overridesCache && now - _overridesCache.at < OVERRIDE_CACHE_MS) {
    return _overridesCache.data;
  }
  const profile = await readProfile();
  const data = (profile.agentOverrides as AgentOverridesMap | undefined) ?? {};
  _overridesCache = { at: now, data };
  return data;
}

export function resolveLibraryAgent(id: string, overrides: AgentOverridesMap): AgentDefinition {
  const base = AGENT_LIBRARY[id];
  if (!base) throw new Error(`Agent '${id}' not found in agent library`);
  return applyAgentOverride(base, overrides[id]);
}
