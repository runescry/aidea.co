export const MODELS = {
  CEO: 'claude-opus-4-8',
  LEADS: 'claude-sonnet-4-6',
  WORKING_GROUPS: 'claude-sonnet-4-6',
  CONFLICT: 'claude-haiku-4-5-20251001',
} as const;

export type RunMode = 'full_auto' | 'pause_after_working_groups';

export interface RunRequest {
  idea: string;
  mode: RunMode;
  sessionId?: string;
}

export interface CompanyIdentity {
  name: string;
  tagline: string;
  mission: string;
  targetCustomer: string;
  valueProposition: string;
  competitiveEdge: string;
}

export interface CEODirective {
  cycleNumber: number;
  text: string;
  priorities: string[];
  targetMetrics: { cpo: string; cmo: string; cto: string; cfo: string };
  constraints: string[];
  issuedAt: string;
}

export interface CPOOutput {
  productVision: string;
  mvpFeatures: Array<{ name: string; description: string; customerPain: string; effort: string }>;
  roadmapQ1: string;
  roadmapQ2: string;
  successMetrics: string[];
  competitivePositioning: string;
}

export interface CMOOutput {
  marketingStrategy: string;
  launchTimeline: string;
  launchTimelineWeeks: number;
  targetAudience: Array<{ name: string; description: string; painPoints: string[]; channels: string[] }>;
  channels: Array<{ name: string; priority: 'primary' | 'secondary'; budget: string; expectedReach: string }>;
  estimatedBudget: string;
  keyMessages: string[];
}

export interface CTOOutput {
  techStack: Array<{ layer: string; choice: string; rationale: string }>;
  architectureOverview: string;
  effortEstimate: string;
  effortEstimateWeeks: number;
  sprintPlan: Array<{ sprintNumber: number; goal: string; deliverables: string[]; duration: string }>;
  technicalRisks: Array<{ title: string; severity: 'high' | 'medium' | 'low'; mitigation: string }>;
  buildVsBuy: Array<{ component: string; decision: 'build' | 'buy' | 'open-source'; rationale: string }>;
}

export interface CFOOutput {
  revenueModel: string;
  year1Projection: { revenue: string; costs: string; ebitda: string; customers: number };
  year2Projection: { revenue: string; costs: string; ebitda: string; customers: number };
  burnRate: string;
  runwayMonths: number;
  fundingRecommendation: string;
  unitEconomics: { cac: string; ltv: string; ltvCacRatio: string; paybackPeriod: string };
  keyAssumptions: string[];
}

export interface LeadOutputs {
  cpo: CPOOutput;
  cmo: CMOOutput;
  cto: CTOOutput;
  cfo: CFOOutput;
}

export interface ConflictReport {
  hasConflict: boolean;
  conflictType: 'timeline_mismatch' | 'budget_constraint' | 'scope_disagreement' | 'none';
  cmoClaim: string;
  ctoClaim: string;
  gapDescription: string;
  severity: 'blocking' | 'manageable' | 'minor';
  ceoArbitration?: string | null;
  resolution?: string | null;
}

export interface CopywriterArtifact {
  landingPageCopy: {
    heroHeadline: string;
    heroSubheadline: string;
    heroCTA: string;
    problemSection: string;
    solutionSection: string;
    featuresSection: Array<{ headline: string; body: string; icon: string }>;
    socialProofSection: string;
    pricingTeaser: string;
    closingCTA: string;
    footerTagline: string;
  };
  emailSequence: Array<{
    emailNumber: number;
    subject: string;
    previewText: string;
    body: string;
    cta: string;
    sendTiming: string;
  }>;
  adVariants: Array<{
    platform: 'meta' | 'google' | 'linkedin';
    headline: string;
    body: string;
    cta: string;
    targetAudience: string;
    hook: string;
  }>;
}

export interface OutreachArtifact {
  messages: Array<{
    personaType: string;
    subjectLine: string | null;
    openingLine: string;
    body: string;
    cta: string;
    channel: 'email' | 'linkedin';
    tonality: string;
  }>;
}

export interface PricingArtifact {
  htmlContent: string;
  tiers: Array<{
    name: string;
    price: string;
    billingPeriod: string;
    tagline: string;
    features: string[];
    cta: string;
    isHighlighted: boolean;
  }>;
}

export interface ResearchArtifact {
  guideMarkdown: string;
  questions: Array<{
    id: number;
    theme: string;
    question: string;
    followUps: string[];
    rationale: string;
  }>;
}

export interface ArtifactSet {
  copywriter?: CopywriterArtifact;
  outreach?: OutreachArtifact;
  pricing?: PricingArtifact;
  research?: ResearchArtifact;
}

export interface Cycle {
  number: number;
  directive: CEODirective;
  startedAt: string;
  completedAt?: string;
  leadOutputs?: LeadOutputs;
  conflictReport?: ConflictReport;
  artifacts?: ArtifactSet;
  cycle2Directive?: CEODirective;
}

export interface MemorySession {
  sessionId: string;
  idea: string;
  mode: RunMode;
  createdAt: string;
  updatedAt: string;
  companyIdentity?: CompanyIdentity;
  cycles: Cycle[];
  status: 'running' | 'paused' | 'complete' | 'error';
}

export interface MemoryFile {
  version: string;
  sessions: MemorySession[];
}

export type SSEEventType =
  | 'session_start'
  | 'ceo_identity_start' | 'ceo_identity_complete'
  | 'ceo_directive_start' | 'ceo_directive_complete'
  | 'lead_start' | 'lead_stream_chunk' | 'lead_complete'
  | 'all_leads_complete'
  | 'conflict_checking' | 'conflict_result'
  | 'ceo_arbitration_start' | 'ceo_arbitration_complete'
  | 'working_group_start' | 'working_group_stream_chunk' | 'working_group_complete'
  | 'all_working_groups_complete'
  | 'ceo_review_start' | 'ceo_cycle2_complete'
  | 'session_complete' | 'session_paused'
  | 'error';

export type AgentId =
  | 'ceo' | 'cpo' | 'cmo' | 'cto' | 'cfo'
  | 'conflict_detector'
  | 'copywriter' | 'outreach' | 'pricing' | 'research';

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  agent?: AgentId;
  sessionId: string;
  cycleNumber: number;
  data: T;
  timestamp: string;
}

export type AgentStatus = 'idle' | 'running' | 'complete' | 'error';

export interface AgentState {
  id: AgentId;
  status: AgentStatus;
  streamBuffer: string;
  completedAt?: string;
}

export interface AppState {
  sessionId: string | null;
  idea: string;
  mode: RunMode;
  isRunning: boolean;
  isPaused: boolean;
  companyIdentity: CompanyIdentity | null;
  directive: CEODirective | null;
  leadOutputs: Partial<LeadOutputs>;
  conflictReport: ConflictReport | null;
  artifacts: ArtifactSet;
  cycle2Directive: CEODirective | null;
  agents: Record<AgentId, AgentState>;
  streamLog: SSEEvent[];
  error: string | null;
}
