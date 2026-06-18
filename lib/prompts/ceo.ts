import type { CompanyIdentity, CEODirective, Cycle, ConflictReport } from '@/types';

export function buildCEOIdentityPrompt(idea: string): string {
  return `You are the founding CEO of a new startup. Crystallize a compelling company identity from this idea.

IDEA: ${idea}

Be ruthlessly specific. Not "small businesses" but "bootstrapped SaaS founders with 1-3 employees who spend 4+ hours/week on manual customer support triage." Not "better UX" but your actual defensible advantage.

Company name: 1-2 words, memorable, not a portmanteau, sounds domain-available.
Tagline: 5-8 words. Punchy. Specific enough to mean something real.

Return ONLY valid JSON with no preamble, no markdown code blocks, no explanation:
{
  "name": "Company name",
  "tagline": "5-8 word tagline",
  "mission": "One sentence. Names who you serve and what change you create in their work/life.",
  "targetCustomer": "Specific persona: job title, company type, company stage, specific pain they have right now.",
  "valueProposition": "The single most compelling reason to choose you. Specific outcome, not feature.",
  "competitiveEdge": "What makes you defensible. Specific advantage over named alternatives."
}`;
}

export function buildCEODirectivePrompt(
  identity: CompanyIdentity,
  idea: string,
  cycleNumber: number
): string {
  return `You are the CEO of ${identity.name} — ${identity.tagline}.

Mission: ${identity.mission}
Target customer: ${identity.targetCustomer}
Value proposition: ${identity.valueProposition}
Original idea: ${idea}

Issue Cycle ${cycleNumber} directive to your four functional leads: CPO, CMO, CTO, CFO.

A strong directive:
- Names concrete deliverables, not work categories
- States real constraints (timeline to first customer contact, budget assumption, team size)
- Has 3 clear priorities in ranked order
- Each lead metric is measurable and specific

Return ONLY valid JSON with no preamble:
{
  "cycleNumber": ${cycleNumber},
  "text": "The full directive as an executive memo. 4-6 sentences. Reads like something a real CEO would send on day one.",
  "priorities": [
    "1. Most critical outcome this cycle",
    "2. Second priority",
    "3. Third priority"
  ],
  "targetMetrics": {
    "cpo": "Specific measurable outcome the CPO owns this cycle",
    "cmo": "Specific measurable outcome the CMO owns this cycle",
    "cto": "Specific measurable outcome the CTO owns this cycle",
    "cfo": "Specific measurable outcome the CFO owns this cycle"
  },
  "constraints": [
    "Budget: specific dollar amount or assumption",
    "Timeline: specific weeks to first customer contact",
    "Team: headcount assumption"
  ]
}`;
}

export function buildCEOReviewPrompt(
  identity: CompanyIdentity,
  cycle: Cycle,
  conflictReport: ConflictReport | null
): string {
  const leads = cycle.leadOutputs;
  const artifacts = cycle.artifacts;

  const cpoSummary = leads?.cpo
    ? `Product vision: ${leads.cpo.productVision.slice(0, 200)} | Features: ${leads.cpo.mvpFeatures.map(f => f.name).join(', ')}`
    : 'Not completed';

  const cmoSummary = leads?.cmo
    ? `Strategy: ${leads.cmo.marketingStrategy.slice(0, 200)} | Launch: ${leads.cmo.launchTimelineWeeks}wks`
    : 'Not completed';

  const ctoSummary = leads?.cto
    ? `Architecture: ${leads.cto.architectureOverview.slice(0, 200)} | Effort: ${leads.cto.effortEstimateWeeks}wks`
    : 'Not completed';

  const cfoSummary = leads?.cfo
    ? `Model: ${leads.cfo.revenueModel} | Runway: ${leads.cfo.runwayMonths}mo | LTV/CAC: ${leads.cfo.unitEconomics.ltvCacRatio}`
    : 'Not completed';

  const artifactSummary = [
    artifacts?.copywriter ? `Landing page copy: DONE (Hero: "${artifacts.copywriter.landingPageCopy.heroHeadline}")` : 'Landing page copy: NOT DONE',
    artifacts?.outreach ? `Outreach messages: ${artifacts.outreach.messages.length} messages written` : 'Outreach messages: NOT DONE',
    artifacts?.pricing ? `Pricing page: DONE (${artifacts.pricing.tiers.length} tiers)` : 'Pricing page: NOT DONE',
    artifacts?.research ? `Research guide: DONE (${artifacts.research.questions.length} questions)` : 'Research guide: NOT DONE',
  ].join('\n');

  const conflictSummary = conflictReport?.hasConflict
    ? `CONFLICT DETECTED (${conflictReport.severity}): ${conflictReport.gapDescription}${conflictReport.resolution ? ` CEO resolved: ${conflictReport.resolution}` : ' Unresolved.'}`
    : 'No conflicts detected.';

  return `You are the CEO of ${identity.name} — ${identity.tagline}.

You just completed Cycle 1. Review all outputs and issue the Cycle 2 directive.

CYCLE 1 DIRECTIVE: ${cycle.directive.text}

CPO OUTPUT: ${cpoSummary}
CMO OUTPUT: ${cmoSummary}
CTO OUTPUT: ${ctoSummary}
CFO OUTPUT: ${cfoSummary}

ARTIFACTS PRODUCED:
${artifactSummary}

CONFLICT STATUS: ${conflictSummary}

As CEO: identify the most critical gap. What would get us to first customer contact fastest?
Issue a Cycle 2 directive that builds on what's done and closes the gaps. Be more specific than Cycle 1 — you have context now.

Return ONLY valid JSON with no preamble:
{
  "cycleNumber": 2,
  "text": "Cycle 2 executive directive. References specific Cycle 1 outputs by name. 4-6 sentences.",
  "priorities": [
    "1. Critical Cycle 2 priority — specific, different from Cycle 1",
    "2. Second priority",
    "3. Third priority"
  ],
  "targetMetrics": {
    "cpo": "Specific Cycle 2 metric for CPO",
    "cmo": "Specific Cycle 2 metric for CMO",
    "cto": "Specific Cycle 2 metric for CTO",
    "cfo": "Specific Cycle 2 metric for CFO"
  },
  "constraints": [
    "Budget: updated constraint based on CFO model",
    "Timeline: updated weeks to first paying customer",
    "Team: updated headcount"
  ]
}`;
}

export function buildCEOArbitrationPrompt(
  conflictReport: ConflictReport,
  identity: CompanyIdentity,
  directive: CEODirective
): string {
  return `You are the CEO of ${identity.name}.

A blocking conflict has been detected between your CMO and CTO.

Conflict: ${conflictReport.gapDescription}
CMO says: ${conflictReport.cmoClaim}
CTO says: ${conflictReport.ctoClaim}

Your top directive priority: ${directive.priorities[0]}
Your constraints: ${directive.constraints.join(' | ')}

Choose ONE option and be decisive:
A. DELAY LAUNCH — accept CTO timeline, reframe marketing as private beta
B. REDUCE SCOPE — cut specific features to hit CMO timeline
C. INCREASE RESOURCES — add contractors, name the headcount and cost impact

Return ONLY valid JSON with no preamble:
{
  "ceoArbitration": "2-3 sentences. First person. Decisive. Names the option chosen and the specific rationale.",
  "resolution": "One concrete sentence: the new agreed timeline or exactly what changes."
}`;
}
