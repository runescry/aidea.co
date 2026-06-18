import type { CMOOutput, CTOOutput, CompanyIdentity, ConflictReport, CEODirective } from '@/types';

export function buildConflictDetectorPrompt(
  cmoOutput: CMOOutput,
  ctoOutput: CTOOutput,
  identity: CompanyIdentity
): string {
  const gap = ctoOutput.effortEstimateWeeks - cmoOutput.launchTimelineWeeks;
  const highRisks = ctoOutput.technicalRisks
    .filter(r => r.severity === 'high')
    .map(r => r.title)
    .join(', ') || 'none';

  return `You are an objective conflict detector for ${identity.name}.

NUMBERS (do not rederive — use these exact values):
- CMO wants to launch in: ${cmoOutput.launchTimelineWeeks} weeks ("${cmoOutput.launchTimeline}")
- CTO estimates effort of: ${ctoOutput.effortEstimateWeeks} weeks ("${ctoOutput.effortEstimate}")
- Gap: ${gap} weeks (CTO estimate minus CMO timeline)
- High-severity technical risks: ${highRisks}

RULES (apply exactly):
- gap <= 2: hasConflict=false, severity="minor", conflictType="none"
- gap 3-6: hasConflict=true, severity="manageable", conflictType="timeline_mismatch"
- gap > 6: hasConflict=true, severity="blocking", conflictType="timeline_mismatch"

CMO claim to summarize: "${cmoOutput.marketingStrategy.slice(0, 150)}"
CTO claim to summarize: "${ctoOutput.architectureOverview.slice(0, 150)}"

Return ONLY valid JSON with no preamble:
{
  "hasConflict": ${gap > 2},
  "conflictType": "${gap > 2 ? 'timeline_mismatch' : 'none'}",
  "cmoClaim": "One sentence summarizing the CMO's timeline position",
  "ctoClaim": "One sentence summarizing the CTO's effort estimate",
  "gapDescription": "${gap > 2 ? 'Describe the gap precisely: what it means for the launch, and the practical implication.' : 'No material conflict. Timelines are aligned.'}",
  "severity": "${gap > 6 ? 'blocking' : gap > 2 ? 'manageable' : 'minor'}",
  "ceoArbitration": null,
  "resolution": null
}`;
}

export function buildCEOArbitrationPrompt(
  conflictReport: ConflictReport,
  identity: CompanyIdentity,
  directive: CEODirective
): string {
  return `You are the CEO of ${identity.name}.

A blocking conflict has been detected between your CMO and CTO.

Gap: ${conflictReport.gapDescription}
CMO position: ${conflictReport.cmoClaim}
CTO position: ${conflictReport.ctoClaim}

Your top directive priority: ${directive.priorities[0]}
Your constraints: ${directive.constraints.join(' | ')}

Choose ONE option and be decisive:
A. DELAY LAUNCH — accept CTO timeline, reframe marketing as private beta outreach
B. REDUCE SCOPE — cut specific features to hit CMO timeline (name which ones)
C. INCREASE RESOURCES — add contractors, name headcount and cost impact

Return ONLY valid JSON with no preamble:
{
  "ceoArbitration": "2-3 sentences. First person. Decisive. Names the option letter chosen and the specific rationale.",
  "resolution": "One concrete sentence: the new agreed timeline, or exactly what changes as a result of this decision."
}`;
}
