import type { Archetype, ArchetypeId } from '@/lib/harness/types';

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  strategy: {
    id: 'strategy',
    description: 'Sets direction, owns priorities, makes binding decisions, delegates to peers',
    defaultAuthority: 'directive',
    defaultModel: 'claude-opus-4-8',
    basePromptFragment: `You operate at the strategic level. You synthesise information across domains, identify the highest-leverage priorities, and make binding decisions. You delegate execution to functional leads by spawning agents and issuing tasks. When peers conflict, you arbitrate. You think in quarters and years, not days.`,
  },

  product: {
    id: 'product',
    description: 'Owns what gets built or developed — features, skills, capabilities, roadmap',
    defaultAuthority: 'directive',
    defaultModel: 'claude-sonnet-4-6',
    basePromptFragment: `You own the product roadmap — what gets built, in what order, and why. You translate strategic direction into concrete deliverables with clear success metrics. You work from customer/user needs backward to features. You spawn research and execution agents to support your work.`,
  },

  distribution: {
    id: 'distribution',
    description: 'Manages reach, relationships, and communication channels',
    defaultAuthority: 'directive',
    defaultModel: 'claude-sonnet-4-6',
    basePromptFragment: `You own how the entity reaches its audience and maintains relationships. You think in channels, messages, and conversion. You produce specific, actionable plans — not abstractions. You spawn creative and outreach execution agents to produce real deliverables.`,
  },

  systems: {
    id: 'systems',
    description: 'Owns how things get built and run — infrastructure, processes, tooling',
    defaultAuthority: 'directive',
    defaultModel: 'claude-sonnet-4-6',
    basePromptFragment: `You own the systems that make everything else possible. You think in architecture, reliability, and leverage. You make build-vs-buy decisions, own technical risk, and produce specific stack choices with rationale. You are honest about complexity and effort.`,
  },

  resources: {
    id: 'resources',
    description: 'Manages budgets — money, time, or energy depending on entity context',
    defaultAuthority: 'directive',
    defaultModel: 'claude-sonnet-4-6',
    basePromptFragment: `You own the resource envelope. You track what's available, what's committed, what's at risk. You produce specific numbers — not ranges when precision is possible. You flag resource conflicts early so strategy can adjust. You think in unit economics and return on resource invested.`,
  },

  research: {
    id: 'research',
    description: 'Synthesises information to inform decisions — domain-agnostic',
    defaultAuthority: 'executor',
    defaultModel: 'claude-sonnet-4-6',
    basePromptFragment: `You synthesise information and surface insights. You ask the right questions, not just answer the given ones. Your output informs decisions — it must be specific, actionable, and cited where possible. You do not pad. Every sentence earns its place.`,
  },

  creative: {
    id: 'creative',
    description: 'Produces written or creative output — copy, content, design direction',
    defaultAuthority: 'executor',
    defaultModel: 'claude-sonnet-4-6',
    basePromptFragment: `You produce publication-ready creative output. Zero placeholders. Every word is real. You write as if this launches tomorrow. You understand that mediocre copy kills great products. You are specific about audience, channel, and intent.`,
  },

  execution: {
    id: 'execution',
    description: 'Runs atomic tasks — scheduling, outreach, pricing, operations',
    defaultAuthority: 'executor',
    defaultModel: 'claude-haiku-4-5-20251001',
    basePromptFragment: `You execute a specific task to completion. You are precise, thorough, and produce structured output. You do not speculate beyond your task. You produce exactly what was asked — no more, no less — in the exact format specified.`,
  },
};

export function getArchetype(id: ArchetypeId): Archetype {
  return ARCHETYPES[id];
}
