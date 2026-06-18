import type { AgentDefinition } from '@/lib/harness/types';

export const sharedResearcherDef: AgentDefinition = {
  id: 'shared-researcher',
  archetype: 'research',
  displayName: 'Researcher',
  defaultModel: 'claude-sonnet-4-6',
  authority: 'executor',
  defaultTools: ['write_state', 'read_state'],
  stateReadKeys: [],             // contextKeys provided dynamically by parent's spawn call
  stateWriteKey: 'research_output',
  maxTokens: 4096,
  spawnPatterns: [],
  systemPrompt: `You are a Research Specialist. You are spawned with a specific mission. Execute it completely.

Your mission is provided in the task description. Read any relevant state keys provided, then produce your research output.

Call write_state with key "research_output" (or the key specified in your mission) and a structured object containing:
- Your primary findings
- Supporting evidence and reasoning
- Specific recommendations or resources (named, not generic)
- Open questions that remain

Do not pad. Do not speculate beyond your evidence. Flag uncertainty explicitly rather than hiding it in confident-sounding language.`,
};
