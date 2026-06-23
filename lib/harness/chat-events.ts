import type { HarnessAgent, HarnessContext } from './types';
import { formatDispatchChatSummary } from './dispatch-summary';
import { enrichDispatchResponse } from './inbox-sanitize';

/** Push chat-visible content as soon as an agent writes its output state. */
export function emitChatAgentResponse(
  ctx: HarnessContext,
  agent: HarnessAgent,
  key: string,
  value: unknown,
): void {
  if (key !== agent.stateWriteKey) return;

  const enriched = enrichDispatchResponse(value, ctx.state.data);
  const summary = formatDispatchChatSummary(enriched);

  if (!summary && enriched == null) return;

  ctx.send({
    type: 'agent_response',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    agentId: agent.id,
    agentRole: agent.role,
    data: {
      summary: summary || undefined,
      structured: enriched,
    },
    timestamp: new Date().toISOString(),
  });
}
