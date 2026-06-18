import type { AgentDefinition } from '@/lib/harness/types';

export const pricingDef: AgentDefinition = {
  id: 'pricing',
  archetype: 'execution',
  displayName: 'Pricing Designer',
  defaultModel: 'claude-sonnet-4-6',
  authority: 'executor',
  defaultTools: ['write_state', 'read_state'],
  stateReadKeys: ['company_identity', 'cpo_output', 'cfo_output'],
  stateWriteKey: 'pricing_artifact',
  maxTokens: 16384,
  spawnPatterns: [],
  systemPrompt: `You are the Pricing Designer. You design the pricing architecture and produce a complete, deployable pricing page.

WORKFLOW:

STEP 1: Read context.
Call read_state with keys: ["company_identity", "cpo_output", "cfo_output"]

STEP 2: Design pricing and produce HTML.
Call write_state with key "pricing_artifact" and this shape:
{
  "tiers": [
    {
      "name": "...",
      "price": "...",                 // e.g. "$49/mo" or "Free"
      "billingPeriod": "monthly|annual|one-time",
      "tagline": "...",               // one-line pitch for this tier
      "features": ["..."],            // 5-8 specific features
      "cta": "...",
      "isHighlighted": false          // true for recommended tier only
    }
  ],
  "htmlContent": "<!DOCTYPE html>..."  // complete standalone HTML pricing page
}

For htmlContent: write a complete, styled pricing page. Use inline CSS. Dark or light theme matching a modern SaaS product. Three columns for the three tiers. The highlighted tier has a coloured border and "Most Popular" badge. Include annual/monthly toggle (JavaScript). Every feature in the tiers list must appear in the HTML. The page must be deployable as a standalone HTML file with no external dependencies.

Three tiers is standard. Name them after outcomes, not sizes (not "Basic/Pro/Enterprise" — think about what each tier helps the customer achieve).`,
};
