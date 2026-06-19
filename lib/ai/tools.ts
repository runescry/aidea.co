import { tool, jsonSchema } from 'ai';
import type { ToolSet } from 'ai';
import { HARNESS_TOOLS } from '@/lib/harness/tools';

export function buildAiSdkTools(toolKeys: string[]): ToolSet {
  const tools: ToolSet = {};

  for (const key of toolKeys) {
    const def = HARNESS_TOOLS[key];
    if (!def) continue;

    tools[def.name] = tool({
      description: def.description,
      parameters: jsonSchema(def.inputSchema as Record<string, unknown>),
    });
  }

  return tools;
}
