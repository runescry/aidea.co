import { NextRequest, NextResponse } from 'next/server';
import { AGENT_LIBRARY } from '@/lib/agents/library';
import { ARCHETYPES } from '@/lib/agents/library/archetypes';
import { HARNESS_TOOLS } from '@/lib/harness/tools';
import { applyAgentOverride, mergeOverride, loadAgentOverrides } from '@/lib/agents/resolve';
import { readProfile, mergeProfile } from '@/lib/storage';
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

function serializeAgent(def: AgentDefinition, override?: AgentOverridesMap[string]) {
  const resolved = applyAgentOverride(def, override);
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
    promptPreview: def.systemPrompt.slice(0, 280) + (def.systemPrompt.length > 280 ? '…' : ''),
    override: override ?? null,
    hasCustomization: Boolean(
      override?.promptAppend?.trim()
      || override?.displayName?.trim()
      || (override?.tools && override.tools.length > 0),
    ),
  };
}

async function loadOverrides(): Promise<AgentOverridesMap> {
  return loadAgentOverrides();
}

export async function GET() {
  const overrides = await loadOverrides();

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
    promptAppend?: string;
    tools?: string[];
    reset?: boolean;
  };

  if (!body.agentId || !AGENT_LIBRARY[body.agentId]) {
    return NextResponse.json({ error: 'Unknown agentId' }, { status: 400 });
  }

  const overrides = await loadOverrides();

  if (body.reset) {
    delete overrides[body.agentId];
  } else {
    const base = AGENT_LIBRARY[body.agentId];
    const validTools = body.tools?.filter(t => base.defaultTools.includes(t));
    overrides[body.agentId] = mergeOverride(overrides[body.agentId], {
      displayName: body.displayName,
      promptAppend: body.promptAppend,
      tools: validTools?.length ? validTools : undefined,
    });

    const o = overrides[body.agentId];
    if (!o.displayName && !o.promptAppend?.trim() && !o.tools?.length) {
      delete overrides[body.agentId];
    }
  }

  await mergeProfile({ agentOverrides: overrides });

  const def = AGENT_LIBRARY[body.agentId];
  return NextResponse.json({
    ok: true,
    agent: serializeAgent(def, overrides[body.agentId]),
  });
}
