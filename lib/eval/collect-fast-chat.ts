import { runFastChat } from '@/lib/harness/fast-chat';
import type { HarnessEvent } from '@/lib/harness/types';

/** Merge harness events from a fast-chat run into final response text. */
export function collectFastChatResponse(events: HarnessEvent[]): string {
  let deltas = '';
  let summary = '';

  for (const event of events) {
    if (event.type === 'agent_text_delta' && typeof event.data.delta === 'string') {
      deltas += event.data.delta;
    }
    if (event.type === 'agent_complete' && typeof event.data.summary === 'string') {
      summary = event.data.summary;
    }
    if (event.type === 'error') {
      const message = typeof event.data.message === 'string' ? event.data.message : 'Fast chat failed';
      throw new Error(message);
    }
    if (event.type === 'entity_error' || event.type === 'agent_error') {
      const message = typeof event.data.message === 'string' ? event.data.message : 'Fast chat failed';
      throw new Error(message);
    }
  }

  return summary.trim() || deltas.trim();
}

/** Run fast-chat with an in-memory event collector; no SSE or harness bootstrap. */
export async function runFastChatToText(command: string): Promise<string> {
  const events: HarnessEvent[] = [];
  const sessionId = crypto.randomUUID();
  const send = (event: HarnessEvent) => {
    events.push(event);
  };

  await runFastChat(command, [], send, sessionId);
  return collectFastChatResponse(events);
}
