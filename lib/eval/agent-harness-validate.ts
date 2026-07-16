import {
  validateInboxTriageRun,
  type InboxTriageValidation,
} from '@/lib/harness/inbox-triage-validate';
import type { HarnessEvent } from '@/lib/harness/types';
import { toolsCalledFromEvents } from './harness-events';

export interface AgentHarnessValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAgentHarnessRun(
  agentId: string,
  events: HarnessEvent[],
  structured: unknown,
  stateData: Record<string, unknown>,
): AgentHarnessValidation {
  if (agentId === 'inbox-triage') {
    const triage = validateInboxTriageRun(events, structured, stateData) as InboxTriageValidation;
    return { ok: triage.ok, errors: triage.errors, warnings: triage.warnings };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const toolsCalled = toolsCalledFromEvents(events);

  if (!events.some(e => e.type === 'entity_complete')) {
    errors.push('Run did not emit entity_complete');
  }
  if (!toolsCalled.includes('write_state')) {
    warnings.push('write_state was not called');
  }
  if (structured == null || (typeof structured === 'object' && Object.keys(structured as object).length === 0)) {
    warnings.push('Agent stateWriteKey output is empty');
  }

  return { ok: errors.length === 0, errors, warnings };
}
