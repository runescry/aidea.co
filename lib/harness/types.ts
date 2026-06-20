// Foundation types — every harness file imports from here.
import type { AgentOverridesMap } from '@/types/agent-overrides';

// ── Enumerations ──────────────────────────────────────────────────────────────

export type Authority = 'directive' | 'advisory' | 'executor';
// directive: spawns agents, issues tasks, triggers consensus, makes binding decisions
// advisory:  provides analysis; cannot spawn or override
// executor:  produces artifacts only; reads state; no spawning

export type MessageType = 'inform' | 'request' | 'flag' | 'delegate' | 'escalate' | 'vote';
export type EntityType = 'company' | 'personal' | 'learning' | 'creator' | 'daily' | 'custom';
export type AutonomyLevel = 'supervised' | 'semi-auto' | 'full-auto';
export type AgentStatus = 'idle' | 'running' | 'waiting' | 'complete' | 'error';
export type ConsensusPhase = 'collecting' | 'negotiating' | 'escalating' | 'resolved';

export type ArchetypeId =
  | 'strategy'      // CEO, Life CEO — sets direction, owns priorities
  | 'product'       // CPO, Growth Director — owns what gets built / developed
  | 'distribution'  // CMO, Relationships Director — manages reach and connections
  | 'systems'       // CTO, Systems Director — owns how things get built/run
  | 'resources'     // CFO, Finance Director — manages money/time/energy budgets
  | 'research'      // Researcher — synthesises information, domain-agnostic
  | 'creative'      // Copywriter, Content Director — produces written/creative output
  | 'execution';    // Outreach, Planner, Pricing — atomic task runner

// ── Archetypes ────────────────────────────────────────────────────────────────

export interface Archetype {
  id: ArchetypeId;
  description: string;
  defaultAuthority: Authority;
  defaultModel: string;
  basePromptFragment: string;
}

// ── Agent Library ─────────────────────────────────────────────────────────────

export interface SpawnPattern {
  agentId: string;        // canonical library ID
  when: string;           // human description of when to spawn
  defaultMission: string; // mission template for the child
}

export interface AgentDefinition {
  id: string;                   // 'ceo' | 'life-ceo' | 'health-director' | ...
  archetype: ArchetypeId;
  displayName: string;
  defaultModel: string;
  authority: Authority;
  defaultTools: string[];       // harness tool keys this agent may use
  systemPrompt: string;         // full role + tool instructions
  stateReadKeys: string[];      // keys to pull from EntityState.data into prompt
  stateWriteKey: string;        // where this agent writes its output
  spawnPatterns: SpawnPattern[];
  maxTokens?: number;           // output token override (default 4096)
  useThinking?: boolean;        // enable extended thinking (Opus only)
  thinkingBudget?: number;      // tokens budget for thinking (default 3000)
}

// ── Runtime Agent ─────────────────────────────────────────────────────────────

export interface AgentMemory {
  crossRunContext: string;
  priorOutputs: string[];       // last N output summaries
}

export interface HarnessAgent {
  id: string;                   // UUID — runtime identity
  definitionId: string;         // library ID
  role: string;                 // same as definitionId for display
  entityId: string;
  parentId: string | null;
  childIds: string[];
  peerIds: string[];
  tier: number;                 // 0 = root, increments per spawn depth
  domain: string;
  authority: Authority;
  model: string;
  allowedTools: string[];
  systemPrompt: string;
  stateReadKeys: string[];
  stateWriteKey: string;
  maxTokens?: number;           // output token cap (default 4096)
  useThinking?: boolean;        // extended thinking (Opus only)
  thinkingBudget?: number;      // thinking token budget (default 3000)
  memory: AgentMemory;
  status: AgentStatus;
  spawnedAt: string;
  completedAt?: string;
  tokensUsed: number;
}

// ── Tasks & Messages ──────────────────────────────────────────────────────────

export interface AgentTask {
  id: string;
  assignedTo: string;           // agentId
  delegatedBy: string;          // agentId
  description: string;
  contextKeys: string[];        // additional state keys beyond agent.stateReadKeys
  createdAt: string;
}

export interface Message {
  id: string;
  type: MessageType;
  fromAgentId: string;
  fromRole: string;
  toRole: string;               // routed to agent with this role in same entity
  topic: string;
  content: string;
  requiresResponse: boolean;
  sentAt: string;
}

// ── Consensus ─────────────────────────────────────────────────────────────────

export interface Vote {
  agentId: string;
  role: string;
  position: string;
  confidence: number;           // 0-1, self-reported
  reasoning: string;
  round: number;
  submittedAt: string;
}

export interface Decision {
  id: string;
  entityId: string;
  topic: string;
  contextKeys: string[];
  stakeholderRoles: string[];
  votes: Vote[];
  rounds: number;
  phase: ConsensusPhase;
  threshold: number;
  outcome?: string;
  decidedBy?: 'consensus' | 'parent';
  parentRole?: string;
  openedAt: string;
  resolvedAt?: string;
}

// ── Entity State ──────────────────────────────────────────────────────────────

export interface EntityState {
  entityId: string;
  entityType: EntityType;
  entityName: string;
  status: 'running' | 'paused' | 'complete' | 'error';
  data: Record<string, unknown>;   // all agent outputs keyed by stateWriteKey
  decisions: Decision[];
  createdAt: string;
  updatedAt: string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export interface AgentRegistry {
  entityId: string;
  agents: Map<string, HarnessAgent>;
  root: string;                   // root agentId
  tierMap: Map<number, string[]>; // tier → [agentIds]
  roleMap: Map<string, string>;   // role → agentId (most-recently spawned with that role)
}

// ── Cost ──────────────────────────────────────────────────────────────────────

export interface CostSnapshot {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedUSD: number;
  agentCount: number;
  toolCallCount: number;
}

export interface CostConfig {
  maxTokensPerRun: number;         // hard stop (default 100_000)
  maxAgentsPerRun: number;         // spawn limit (default 25)
  maxTierDepth: number;            // depth limit (default 4)
  warnAtPercent: number;           // 0.8 = warn at 80% of budget
  realWorldToolMode: 'auto' | 'require-approval' | 'dry-run';
  agentTimeoutMs: number;          // per-agent timeout (default 60_000)
  runTimeoutMs: number;            // per-run timeout (default 300_000)
}

export const DEFAULT_COST_CONFIG: CostConfig = {
  maxTokensPerRun: 100_000,
  maxAgentsPerRun: 25,
  maxTierDepth: 4,
  warnAtPercent: 0.8,
  realWorldToolMode: 'dry-run',
  agentTimeoutMs: 90_000,
  runTimeoutMs: 360_000,
};

export interface CostTracker {
  config: CostConfig;
  snapshot(): CostSnapshot;
  recordUsage(inputTokens: number, outputTokens: number, cacheRead?: number, cacheWrite?: number): void;
  recordAgent(): void;
  recordToolCall(): void;
  isOverBudget(): boolean;
  isNearBudget(): boolean;
  estimatedUSD(): number;
  canSpawnAgent(): boolean;
  canSpawnAtTier(tier: number): boolean;
}

// ── Entity Config ─────────────────────────────────────────────────────────────

export interface EntityInput {
  [key: string]: unknown;
}

export interface EntityConfig {
  type: EntityType;
  name: string;
  mission: string;
  rootAgentId: string;             // ID from agent library
  agentIds: string[];              // all agent IDs this entity can use
  availableTools: string[];        // tool keys available to agents in this entity
  autonomy: AutonomyLevel;
  consensusThreshold: number;      // 0-1
  costConfig?: Partial<CostConfig>;
  /** Skip Postgres writes on each write_state; persist once at entity end. */
  deferStatePersist?: boolean;
  buildInitialContext: (input: EntityInput) => Record<string, unknown>;
  buildInitialTask: (input: EntityInput) => Pick<AgentTask, 'description' | 'contextKeys'>;
}

// ── Harness Context (threaded through all harness functions) ──────────────────

export interface HarnessContext {
  entityId: string;
  sessionId: string;
  config: EntityConfig;
  registry: AgentRegistry;
  state: EntityState;
  cost: CostTracker;
  bus: MessageBus;
  send: SenderFn;
  agentOverrides: AgentOverridesMap;
}

// ── SSE Events ────────────────────────────────────────────────────────────────

export type HarnessEventType =
  | 'entity_started'    | 'entity_complete'    | 'entity_paused'   | 'entity_error'
  | 'agent_spawned'     | 'agent_started'      | 'agent_complete'  | 'agent_error'
  | 'agent_text_delta'  | 'agent_response'
  | 'tool_called'       | 'tool_result'
  | 'message_sent'
  | 'state_updated'
  | 'consensus_started' | 'consensus_vote'     | 'consensus_resolved' | 'consensus_escalated'
  | 'cost_update'       | 'cost_warning'       | 'budget_exceeded'
  | 'human_input_requested'
  | 'error';

export interface HarnessEvent {
  type: HarnessEventType;
  sessionId: string;
  entityId?: string;
  agentId?: string;
  agentRole?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export type SenderFn = (e: HarnessEvent) => void;

// ── Message Bus & Event System ────────────────────────────────────────────────

export interface MessageBus {
  subscribe(role: string, handler: (msg: Message) => void): void;
  publish(msg: Message): void;
  drain(role: string): Message[];   // get all pending messages for a role
}

export interface EventSystem {
  emit(topic: string, entityId: string, payload: Record<string, unknown>): void;
  on(topic: string, handler: (entityId: string, payload: Record<string, unknown>) => void): () => void;
}

// ── Tool Definitions ──────────────────────────────────────────────────────────

export interface ToolInput {
  [key: string]: unknown;
}

export interface HarnessTool {
  key: string;
  name: string;                    // Claude tool name (no spaces)
  description: string;
  inputSchema: Record<string, unknown>;
  requiresApproval: boolean;       // real-world tools gate
  realWorld: boolean;
}
