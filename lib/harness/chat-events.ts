import type { HarnessAgent, HarnessContext } from './types';

/** Push chat-visible content as soon as an agent writes its output state. */
export function emitChatAgentResponse(
  ctx: HarnessContext,
  agent: HarnessAgent,
  key: string,
  value: unknown,
): void {
  if (key !== agent.stateWriteKey) return;

  let summary = '';
  if (value && typeof value === 'object' && value !== null && 'summary' in value) {
    const s = (value as { summary?: unknown }).summary;
    if (typeof s === 'string') summary = s.trim();
  } else if (typeof value === 'string') {
    summary = value.trim();
  }

  if (!summary && value == null) return;

  ctx.send({
    type: 'agent_response',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    agentId: agent.id,
    agentRole: agent.role,
    data: {
      summary: summary || undefined,
      structured: value,
    },
    timestamp: new Date().toISOString(),
  });
}
