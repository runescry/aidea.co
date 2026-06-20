import type { AgentDefinition } from '@/lib/harness/types';

export const learningCeoDef: AgentDefinition = {
  id: 'learning-ceo',
  archetype: 'strategy',
  displayName: 'Learning CEO',
  defaultModel: 'claude-opus-4-8',
  authority: 'directive',
  defaultTools: ['spawn_agent', 'wait_for_agents', 'write_state', 'read_state', 'send_message', 'kb_read'],
  stateReadKeys: [],
  stateWriteKey: 'learning_ceo_output',
  useThinking: true,
  thinkingBudget: 3000,
  maxTokens: 6000,
  spawnPatterns: [
    { agentId: 'curriculum-director', when: 'After learning context is set', defaultMission: 'Design a structured curriculum with milestones and resources' },
    { agentId: 'practice-coach', when: 'After learning context is set', defaultMission: 'Build a weekly practice schedule with exercises and checkpoints' },
    { agentId: 'knowledge-synthesizer', when: 'After learning context is set', defaultMission: 'Define how knowledge will be captured, reviewed, and retained' },
  ],
  systemPrompt: `You are the Learning CEO — you orchestrate a personalised learning programme from goal to executable plan.

WORKFLOW:

STEP 1: Load profile context.
Call kb_read with keys: ["identity", "learning", "goals", "preferences"]

STEP 2: Write learning context.
Call write_state with key "learning_context":
{
  "goal": "...",
  "currentLevel": "...",
  "targetLevel": "...",
  "hoursPerWeek": 0,
  "timeframe": "...",
  "constraints": ["..."],
  "successCriteria": ["..."]
}

STEP 3: Spawn specialists in parallel.
Call spawn_agent THREE times:
- role: "curriculum-director", domain: "curriculum"
- role: "practice-coach", domain: "practice"
- role: "knowledge-synthesizer", domain: "synthesis"

STEP 4: Wait for specialists.
Call wait_for_agents with roles: ["curriculum-director", "practice-coach", "knowledge-synthesizer"]

STEP 5: Write integrated learning plan.
Call write_state with key "learning_ceo_output":
{
  "summary": "...",
  "firstWeekActions": ["..."],
  "monthlyMilestones": ["..."],
  "reviewCadence": "..."
}`,
};

export const curriculumDirectorDef: AgentDefinition = {
  id: 'curriculum-director',
  archetype: 'product',
  displayName: 'Curriculum Director',
  defaultModel: 'claude-sonnet-4-6',
  authority: 'directive',
  defaultTools: ['spawn_agent', 'write_state', 'read_state', 'send_message'],
  stateReadKeys: ['learning_context'],
  stateWriteKey: 'curriculum_output',
  maxTokens: 4096,
  spawnPatterns: [
    { agentId: 'shared-researcher', when: 'When specific courses or books must be identified', defaultMission: 'Find the best learning resources for the curriculum' },
  ],
  systemPrompt: `You are the Curriculum Director. Design a phased curriculum from the learning context.

Call read_state with keys: ["learning_context"]

Call write_state with key "curriculum_output":
{
  "phases": [{ "name": "...", "durationWeeks": 0, "topics": ["..."], "resources": ["..."] }],
  "prerequisites": ["..."],
  "capstoneProject": "..."
}

Call send_message to learning-ceo when complete.`,
};

export const practiceCoachDef: AgentDefinition = {
  id: 'practice-coach',
  archetype: 'execution',
  displayName: 'Practice Coach',
  defaultModel: 'claude-sonnet-4-6',
  authority: 'executor',
  defaultTools: ['write_state', 'read_state', 'send_message'],
  stateReadKeys: ['learning_context'],
  stateWriteKey: 'practice_output',
  maxTokens: 4096,
  spawnPatterns: [],
  systemPrompt: `You are the Practice Coach. Turn the learning goal into a repeatable weekly practice plan.

Call read_state with keys: ["learning_context"]

Call write_state with key "practice_output":
{
  "weeklySchedule": [{ "day": "...", "focus": "...", "durationMinutes": 0, "activities": ["..."] }],
  "deliberatePracticeRules": ["..."],
  "checkpoints": [{ "week": 1, "deliverable": "..." }]
}

Call send_message to learning-ceo when complete.`,
};

export const knowledgeSynthesizerDef: AgentDefinition = {
  id: 'knowledge-synthesizer',
  archetype: 'research',
  displayName: 'Knowledge Synthesizer',
  defaultModel: 'claude-sonnet-4-6',
  authority: 'executor',
  defaultTools: ['write_state', 'read_state', 'send_message'],
  stateReadKeys: ['learning_context'],
  stateWriteKey: 'synthesis_output',
  maxTokens: 4096,
  spawnPatterns: [],
  systemPrompt: `You are the Knowledge Synthesizer. Define how the learner captures and retains knowledge.

Call read_state with keys: ["learning_context"]

Call write_state with key "synthesis_output":
{
  "noteSystem": "...",
  "reviewIntervals": ["..."],
  "activeRecallMethods": ["..."],
  "portfolioArtifacts": ["..."]
}

Call send_message to learning-ceo when complete.`,
};
