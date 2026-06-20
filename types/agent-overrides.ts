export interface AgentOverride {
  displayName?: string;
  /** Full replacement for the built-in system prompt */
  systemPromptReplace?: string;
  /** Appended after the resolved system prompt */
  promptAppend?: string;
  /** When set (including []), replaces the default tool list */
  tools?: string[];
  updatedAt?: string;
}

export type AgentOverridesMap = Record<string, AgentOverride>;
