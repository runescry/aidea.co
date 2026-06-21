import type { HarnessAgent, HarnessContext } from './types';
import { formatDispatchChatSummary } from './dispatch-summary';

/** Push chat-visible content as soon as an agent writes its output state. */
export function emitChatAgentResponse(
  ctx: HarnessContext,
  agent: HarnessAgent,
  key: string,
  value: unknown,
): void {
  if (key !== agent.stateWriteKey) return;

  const summary = formatDispatchChatSummary(value);

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
