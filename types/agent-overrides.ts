export interface AgentOverride {
  displayName?: string;
  /** Appended after the base system prompt */
  promptAppend?: string;
  /** Replaces default tool list when set */
  tools?: string[];
  updatedAt?: string;
}

export type AgentOverridesMap = Record<string, AgentOverride>;
