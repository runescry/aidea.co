import type { HarnessEvent } from '@/lib/harness/types';

export interface HarnessToolCallRecord {
  name: string;
  input: Record<string, unknown>;
}

export function extractToolCallsFromEvents(events: HarnessEvent[]): HarnessToolCallRecord[] {
  return events
    .filter(e => e.type === 'tool_called')
    .map(e => ({
      name: String((e.data as { tool?: string }).tool ?? ''),
      input: ((e.data as { input?: Record<string, unknown> }).input ?? {}) as Record<string, unknown>,
    }))
    .filter(t => t.name.length > 0);
}

export function toolsCalledFromEvents(events: HarnessEvent[]): string[] {
  return [...new Set(extractToolCallsFromEvents(events).map(t => t.name))];
}

export function responseTextFromEvents(
  events: HarnessEvent[],
  structured: unknown,
  formatStructured: (value: unknown) => string,
): string {
  for (const event of [...events].reverse()) {
    if (event.type === 'agent_complete' && typeof event.data.summary === 'string') {
      const summary = event.data.summary.trim();
      if (summary && summary !== 'Done.') return summary;
    }
  }
  const fromStructured = formatStructured(structured);
  if (fromStructured) return fromStructured;
  return '';
}
