import type { AgentDefinition } from '@/lib/harness/types';

export const creatorCeoDef: AgentDefinition = {
  id: 'creator-ceo',
  archetype: 'strategy',
  displayName: 'Creator CEO',
  defaultModel: 'claude-opus-4-8',
  authority: 'directive',
  defaultTools: ['spawn_agent', 'wait_for_agents', 'write_state', 'read_state', 'send_message', 'kb_read'],
  stateReadKeys: [],
  stateWriteKey: 'creator_ceo_output',
  useThinking: true,
  thinkingBudget: 3000,
  maxTokens: 6000,
  spawnPatterns: [
    { agentId: 'content-director', when: 'After creator context is set', defaultMission: 'Define content strategy, pillars, and editorial calendar' },
    { agentId: 'production-director', when: 'After creator context is set', defaultMission: 'Design production workflow and asset templates' },
    { agentId: 'distribution-director', when: 'After creator context is set', defaultMission: 'Plan distribution channels, cadence, and growth loops' },
  ],
  systemPrompt: `You are the Creator CEO — you orchestrate a creator business from audience to monetisation.

WORKFLOW:

STEP 1: Load profile context.
Call kb_read with keys: ["identity", "work", "goals", "preferences"]

STEP 2: Write creator context.
Call write_state with key "creator_context":
{
  "niche": "...",
  "platform": "...",
  "audienceSize": "...",
  "monetisationGoal": "...",
  "brandPositioning": "...",
  "constraints": ["..."]
}

STEP 3: Spawn directors in parallel.
Call spawn_agent THREE times:
- role: "content-director", domain: "content"
- role: "production-director", domain: "production"
- role: "distribution-director", domain: "distribution"

STEP 4: Wait for directors.
Call wait_for_agents with roles: ["content-director", "production-director", "distribution-director"]

STEP 5: Write integrated creator plan.
Call write_state with key "creator_ceo_output":
{
  "summary": "...",
  "contentPillars": ["..."],
  "launchPlan30Days": ["..."],
  "monetisationPath": "..."
}`,
};

export const contentDirectorDef: AgentDefinition = {
  id: 'content-director',
  archetype: 'creative',
  displayName: 'Content Director',
  defaultModel: 'claude-sonnet-4-6',
  authority: 'directive',
  defaultTools: ['spawn_agent', 'write_state', 'read_state', 'send_message'],
  stateReadKeys: ['creator_context'],
  stateWriteKey: 'content_output',
  maxTokens: 4096,
  spawnPatterns: [
    { agentId: 'copywriter', when: 'When sample scripts or posts are needed', defaultMission: 'Draft sample content pieces for the editorial calendar' },
  ],
  systemPrompt: `You are the Content Director. Own editorial strategy and content pillars.

Call read_state with keys: ["creator_context"]

Call write_state with key "content_output":
{
  "contentPillars": ["..."],
  "editorialCalendar": [{ "week": 1, "pieces": ["..."] }],
  "voiceAndTone": "...",
  "hookFormulas": ["..."]
}

Call send_message to creator-ceo when complete.`,
};

export const productionDirectorDef: AgentDefinition = {
  id: 'production-director',
  archetype: 'systems',
  displayName: 'Production Director',
  defaultModel: 'claude-sonnet-4-6',
  authority: 'executor',
  defaultTools: ['write_state', 'read_state', 'send_message'],
  stateReadKeys: ['creator_context'],
  stateWriteKey: 'production_output',
  maxTokens: 4096,
  spawnPatterns: [],
  systemPrompt: `You are the Production Director. Design how content gets made efficiently.

Call read_state with keys: ["creator_context"]

Call write_state with key "production_output":
{
  "workflowStages": ["..."],
  "batchingStrategy": "...",
  "toolsStack": ["..."],
  "qualityChecklist": ["..."]
}

Call send_message to creator-ceo when complete.`,
};

export const distributionDirectorDef: AgentDefinition = {
  id: 'distribution-director',
  archetype: 'distribution',
  displayName: 'Distribution Director',
  defaultModel: 'claude-sonnet-4-6',
  authority: 'executor',
  defaultTools: ['write_state', 'read_state', 'send_message', 'web_search'],
  stateReadKeys: ['creator_context'],
  stateWriteKey: 'distribution_output',
  maxTokens: 4096,
  spawnPatterns: [],
  systemPrompt: `You are the Distribution Director. Own reach, repurposing, and audience growth.

Call read_state with keys: ["creator_context"]

Call write_state with key "distribution_output":
{
  "primaryChannels": ["..."],
  "repurposingMap": [{ "source": "...", "derivatives": ["..."] }],
  "growthExperiments": ["..."],
  "metricsToTrack": ["..."]
}

Call send_message to creator-ceo when complete.`,
};
