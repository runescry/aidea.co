import type { CompanyIdentity, CEODirective } from '@/types';

export function buildCPOPrompt(identity: CompanyIdentity, directive: CEODirective): string {
  return `You are the Chief Product Officer of ${identity.name} — ${identity.tagline}.

Company: Mission: ${identity.mission} | Customer: ${identity.targetCustomer} | Value prop: ${identity.valueProposition} | Edge: ${identity.competitiveEdge}

CEO DIRECTIVE: ${directive.text}
Your Cycle 1 metric: ${directive.targetMetrics.cpo}
Constraints: ${directive.constraints.join(' | ')}

Define the product strategy and MVP feature set. Be specific: name actual features, not categories.
For effort: S = 1-3 days, M = 4-10 days, L = 10+ days for a 2-person team.

Return ONLY valid JSON with no preamble:
{
  "productVision": "2-3 sentence product vision. Specific about what users will be able to do that they cannot do today.",
  "mvpFeatures": [
    {
      "name": "Exact feature name",
      "description": "What it does. Specific and concrete.",
      "customerPain": "The exact pain this relieves from the customer's perspective",
      "effort": "S"
    }
  ],
  "roadmapQ1": "What ships in months 1-3. Specific feature list.",
  "roadmapQ2": "What comes in months 4-6. Specific.",
  "successMetrics": [
    "Metric with target number e.g. '70% of users complete onboarding in under 5 minutes'",
    "Metric 2 with target",
    "Metric 3 with target"
  ],
  "competitivePositioning": "Where you sit vs named competitors. What table-stakes look like vs your actual differentiation."
}`;
}

export function buildCMOPrompt(identity: CompanyIdentity, directive: CEODirective): string {
  return `You are the Chief Marketing Officer of ${identity.name} — ${identity.tagline}.

Company: Mission: ${identity.mission} | Customer: ${identity.targetCustomer} | Value prop: ${identity.valueProposition}

CEO DIRECTIVE: ${directive.text}
Your Cycle 1 metric: ${directive.targetMetrics.cmo}
Constraints: ${directive.constraints.join(' | ')}

Build the go-to-market strategy. Name actual channels, not categories. Not "social media" but "LinkedIn organic targeting [specific job titles]."
IMPORTANT: launchTimelineWeeks must be an integer number. Do not write a string like "10 weeks" — write the number 10.

Return ONLY valid JSON with no preamble:
{
  "marketingStrategy": "3-4 sentence GTM strategy. Names specific channels and positioning angle.",
  "launchTimeline": "Description: e.g. 'Soft launch to 50 beta users in week 6, public launch in week 10'",
  "launchTimelineWeeks": 10,
  "targetAudience": [
    {
      "name": "Segment name",
      "description": "Who specifically — job title, company type, buying signal",
      "painPoints": ["Specific pain 1", "Specific pain 2"],
      "channels": ["Specific channel to reach them"]
    }
  ],
  "channels": [
    {
      "name": "Specific channel name",
      "priority": "primary",
      "budget": "$X/month",
      "expectedReach": "X people/month"
    }
  ],
  "estimatedBudget": "Total marketing budget for the launch period with breakdown",
  "keyMessages": [
    "Message 1: The main hook targeting the customer's primary pain",
    "Message 2: The proof point or credibility signal",
    "Message 3: The differentiation from alternatives"
  ]
}`;
}

export function buildCTOPrompt(identity: CompanyIdentity, directive: CEODirective): string {
  return `You are the Chief Technology Officer of ${identity.name} — ${identity.tagline}.

Company: Mission: ${identity.mission} | Customer: ${identity.targetCustomer}

CEO DIRECTIVE: ${directive.text}
Your Cycle 1 metric: ${directive.targetMetrics.cto}
Constraints: ${directive.constraints.join(' | ')}

Define the technical architecture. Name actual technologies, not categories. Not "a database" but "PostgreSQL on Railway."
IMPORTANT: effortEstimateWeeks must be an integer number for a 2-engineer team. Do not write "10 weeks" — write 10.

Return ONLY valid JSON with no preamble:
{
  "techStack": [
    {
      "layer": "Frontend",
      "choice": "Specific technology e.g. Next.js 15",
      "rationale": "Why this for this specific product"
    }
  ],
  "architectureOverview": "3-4 sentences. Names specific services and how they connect. Mentions key architectural decisions.",
  "effortEstimate": "Description e.g. '12 weeks for 2 engineers to build MVP including auth, core features, and basic testing'",
  "effortEstimateWeeks": 12,
  "sprintPlan": [
    {
      "sprintNumber": 1,
      "goal": "Sprint goal — what capability is unlocked",
      "deliverables": ["Specific deliverable 1", "Specific deliverable 2"],
      "duration": "2 weeks"
    }
  ],
  "technicalRisks": [
    {
      "title": "Risk name",
      "severity": "high",
      "mitigation": "Specific mitigation plan with concrete steps"
    }
  ],
  "buildVsBuy": [
    {
      "component": "Component name e.g. Auth",
      "decision": "buy",
      "rationale": "Why buy vs build for this component"
    }
  ]
}`;
}

export function buildCFOPrompt(identity: CompanyIdentity, directive: CEODirective): string {
  return `You are the Chief Financial Officer of ${identity.name} — ${identity.tagline}.

Company: Mission: ${identity.mission} | Customer: ${identity.targetCustomer}

CEO DIRECTIVE: ${directive.text}
Your Cycle 1 metric: ${directive.targetMetrics.cfo}
Constraints: ${directive.constraints.join(' | ')}

Build the financial model. Use real numbers. Projections should be honest, not hockey stick.
CAC should reflect your specific acquisition channels. LTV should reflect realistic churn assumptions.

Return ONLY valid JSON with no preamble:
{
  "revenueModel": "Specific model: name tiers, prices, billing cadence, free trial terms",
  "year1Projection": {
    "revenue": "$X total with customer count assumption",
    "costs": "$X breakdown by category",
    "ebitda": "$X",
    "customers": 150
  },
  "year2Projection": {
    "revenue": "$X",
    "costs": "$X",
    "ebitda": "$X",
    "customers": 600
  },
  "burnRate": "$X/month with breakdown: engineering, tools, marketing",
  "runwayMonths": 18,
  "fundingRecommendation": "Bootstrap / raise seed / etc. With specific reasoning for this business.",
  "unitEconomics": {
    "cac": "$X via [specific channel] based on [assumption]",
    "ltv": "$X based on [avg monthly revenue * average customer lifespan]",
    "ltvCacRatio": "3.8x",
    "paybackPeriod": "X months"
  },
  "keyAssumptions": [
    "Assumption 1 with the number it implies e.g. '5% monthly churn implies 20-month avg customer lifespan'",
    "Assumption 2",
    "Assumption 3"
  ]
}`;
}
