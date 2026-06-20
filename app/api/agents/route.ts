import { NextRequest, NextResponse } from 'next/server';
import { AGENT_LIBRARY } from '@/lib/agents/library';
import { ARCHETYPES } from '@/lib/agents/library/archetypes';
import { HARNESS_TOOLS } from '@/lib/harness/tools';
import {
  applyAgentOverride,
  mergeOverride,
  loadAgentOverrides,
  buildEffectiveSystemPrompt,
  hasActiveCustomization,
  isOverrideEmpty,
} from '@/lib/agents/resolve';
import { mergeProfile } from '@/lib/storage';
import type { AgentOverridesMap } from '@/types/agent-overrides';
import type { AgentDefinition } from '@/lib/harness/types';

export const runtime = 'nodejs';

const GROUPS: Array<{ id: string; label: string; agentIds: string[] }> = [
  {
    id: 'command',
    label: 'Command',
    agentIds: ['dispatcher'],
  },
  {
    id: 'daily',
    label: 'Daily operations',
    agentIds: [
      'daily-orchestrator', 'inbox-triage', 'calendar-reader',
      'health-briefer', 'news-curator', 'work-prep',
    ],
  },
  {
    id: 'personal',
    label: 'Personal OS',
    agentIds: [
      'life-ceo', 'values-director', 'mental-health-director',
      'growth-director', 'health-director', 'finance-director',
      'relationships-director', 'systems-director', 'relationship-monitor',
    ],
  },
  {
    id: 'company',
    label: 'Company',
    agentIds: [
      'ceo', 'cpo', 'cmo', 'cto', 'cfo',
      'copywriter', 'outreach', 'pricing', 'research',
    ],
  },
  {
    id: 'shared',
    label: 'Shared',
    agentIds: ['shared-researcher', 'shared-planner'],
  },
];

function toolsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((t, i) => t === sb[i]);
}

function serializeAgent(def: AgentDefinition, override?: AgentOverridesMap[string]) {
  const resolved = applyAgentOverride(def, override);
  const effectivePrompt = buildEffectiveSystemPrompt(def, override ?? undefined);

  return {
    id: def.id,
    displayName: resolved.displayName,
    baseDisplayName: def.displayName,
    archetype: def.archetype,
    archetypeLabel: ARCHETYPES[def.archetype]?.description ?? def.archetype,
    authority: def.authority,
    defaultModel: def.defaultModel,
    stateWriteKey: def.stateWriteKey,
    baseTools: def.defaultTools,
    tools: resolved.defaultTools,
    systemPrompt: def.systemPrompt,
    effectiveSystemPrompt: effectivePrompt,
    promptPreview: effectivePrompt.slice(0, 320) + (effectivePrompt.length > 320 ? '…' : ''),
    override: override ?? null,
    hasCustomization: hasActiveCustomization(def, override),
  };
}

export async function GET() {
  const overrides = await loadAgentOverrides();

  const toolCatalog = Object.fromEntries(
    Object.entries(HARNESS_TOOLS).map(([key, tool]) => [
      key,
      { key, name: tool.name, description: tool.description, realWorld: tool.realWorld },
    ]),
  );

  const groups = GROUPS.map(group => ({
    ...group,
    agents: group.agentIds
      .filter(id => AGENT_LIBRARY[id])
      .map(id => serializeAgent(AGENT_LIBRARY[id], overrides[id])),
  }));

  const ungrouped = Object.keys(AGENT_LIBRARY).filter(
    id => !GROUPS.some(g => g.agentIds.includes(id)),
  );

  if (ungrouped.length > 0) {
    groups.push({
      id: 'other',
      label: 'Other',
      agentIds: ungrouped,
      agents: ungrouped.map(id => serializeAgent(AGENT_LIBRARY[id], overrides[id])),
    });
  }

  return NextResponse.json({ groups, toolCatalog });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    agentId: string;
    displayName?: string;
    systemPromptReplace?: string;
    promptAppend?: string;
    tools?: string[];
    reset?: boolean;
  };

  if (!body.agentId || !AGENT_LIBRARY[body.agentId]) {
    return NextResponse.json({ error: 'Unknown agentId' }, { status: 400 });
  }

  const overrides = await loadAgentOverrides();
  const base = AGENT_LIBRARY[body.agentId];

  if (body.reset) {
    delete overrides[body.agentId];
  } else {
    const validTools = body.tools?.filter(t => base.defaultTools.includes(t));

    let toolsUpdate: string[] | undefined;
    if (body.tools !== undefined) {
      if (!validTools || !toolsEqual(validTools, base.defaultTools)) {
        toolsUpdate = validTools ?? [];
      }
    }

    overrides[body.agentId] = mergeOverride(overrides[body.agentId], {
      displayName: body.displayName,
      systemPromptReplace: body.systemPromptReplace,
      promptAppend: body.promptAppend,
      tools: toolsUpdate,
    });

    if (isOverrideEmpty(overrides[body.agentId])) {
      delete overrides[body.agentId];
    }
  }

  await mergeProfile({ agentOverrides: overrides });

  return NextResponse.json({
    ok: true,
    agent: serializeAgent(base, overrides[body.agentId]),
  });
}
