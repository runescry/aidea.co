import type { InboxTriagePayload } from './inbox-sanitize';
import { getGmailCache } from './inbox-sanitize';
import type { HarnessEvent } from './types';

export interface InboxTriageValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    urgent: number;
    actionRequired: number;
    fyi: number;
    gmailEmails: number;
    toolsCalled: string[];
    queuedActions: number;
    attributionWarnings: number;
  };
}

const LIMITS = { urgent: 5, actionRequired: 5, fyi: 3 } as const;

function triageLists(triage: InboxTriagePayload): {
  urgent: Record<string, unknown>[];
  actionRequired: Record<string, unknown>[];
  fyi: Record<string, unknown>[];
} {
  const asRows = (list: unknown[] | undefined) =>
    (list ?? []).filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');

  return {
    urgent: asRows(triage.urgent as unknown[] | undefined),
    actionRequired: asRows(triage.actionRequired as unknown[] | undefined),
    fyi: asRows(triage.fyi as unknown[] | undefined),
  };
}

function toolsFromEvents(events: HarnessEvent[]): string[] {
  const names = events
    .filter(e => e.type === 'tool_called')
    .map(e => String((e.data as { tool?: string }).tool ?? ''))
    .filter(Boolean);
  return [...new Set(names)];
}

function validateTriageItem(
  item: Record<string, unknown>,
  gmailIds: Set<string>,
  listName: string,
  index: number,
  errors: string[],
  warnings: string[],
): void {
  const prefix = `${listName}[${index}]`;

  if (item.attributionWarning) {
    warnings.push(`${prefix}: ${String(item.attributionWarning)}`);
  }

  const messageId = item.messageId ? String(item.messageId) : '';
  if (messageId && gmailIds.size > 0 && !gmailIds.has(messageId)) {
    errors.push(`${prefix}: messageId "${messageId}" not found in gmail_read cache`);
  }

  if (!String(item.reason ?? item.action ?? item.subject ?? '').trim()) {
    warnings.push(`${prefix}: missing reason/action/subject`);
  }
}

/** Validate inbox_triage output and harness events after a triage run. */
export function validateInboxTriageRun(
  events: HarnessEvent[],
  inboxTriage: unknown,
  stateData: Record<string, unknown>,
): InboxTriageValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!events.some(e => e.type === 'entity_complete')) {
    errors.push('Run did not emit entity_complete');
  }
  if (events.some(e => e.type === 'entity_error')) {
    const err = events.find(e => e.type === 'entity_error');
    errors.push(`entity_error: ${JSON.stringify(err?.data)}`);
  }

  const agentError = events.find(e => e.type === 'agent_error' && e.agentRole === 'inbox-triage');
  if (agentError) {
    errors.push(`inbox-triage agent_error: ${JSON.stringify(agentError.data)}`);
  }

  const toolsCalled = toolsFromEvents(events);
  if (!toolsCalled.includes('gmail_read')) {
    errors.push('gmail_read was not called');
  }
  if (!toolsCalled.includes('kb_read')) {
    warnings.push('kb_read was not called (profile context may be incomplete)');
  }
  if (!toolsCalled.includes('write_state')) {
    errors.push('write_state was not called');
  }

  if (!inboxTriage || typeof inboxTriage !== 'object') {
    errors.push('inbox_triage state missing or not an object');
    return {
      ok: errors.length === 0,
      errors,
      warnings,
      stats: {
        urgent: 0,
        actionRequired: 0,
        fyi: 0,
        gmailEmails: getGmailCache(stateData).size,
        toolsCalled,
        queuedActions: 0,
        attributionWarnings: 0,
      },
    };
  }

  const triage = inboxTriage as InboxTriagePayload;
  const { urgent, actionRequired, fyi } = triageLists(triage);
  const gmailIds = new Set([...getGmailCache(stateData).keys()]);

  for (const [listName, limit] of Object.entries(LIMITS) as Array<[keyof typeof LIMITS, number]>) {
    const rows = listName === 'urgent' ? urgent : listName === 'actionRequired' ? actionRequired : fyi;
    if (rows.length > limit) {
      errors.push(`${listName} has ${rows.length} items (max ${limit})`);
    }
    rows.forEach((item, i) => validateTriageItem(item, gmailIds, listName, i, errors, warnings));
  }

  const queuedActions = events.filter(
    e => e.type === 'tool_called'
      && (e.data as { tool?: string }).tool === 'queue_action'
      && e.agentRole === 'inbox-triage',
  ).length;

  const attributionWarnings = [...urgent, ...actionRequired, ...fyi].filter(
    item => Boolean(item.attributionWarning),
  ).length;

  if (gmailIds.size === 0) {
    warnings.push('gmail_read returned no cached emails');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      urgent: urgent.length,
      actionRequired: actionRequired.length,
      fyi: fyi.length,
      gmailEmails: gmailIds.size,
      toolsCalled,
      queuedActions,
      attributionWarnings,
    },
  };
}

export function formatInboxTriageReport(validation: InboxTriageValidation): string {
  const lines = [
    validation.ok ? 'PASS' : 'FAIL',
    `urgent=${validation.stats.urgent} actionRequired=${validation.stats.actionRequired} fyi=${validation.stats.fyi}`,
    `gmailEmails=${validation.stats.gmailEmails} queuedActions=${validation.stats.queuedActions}`,
    `tools: ${validation.stats.toolsCalled.join(', ') || '(none)'}`,
  ];

  if (validation.errors.length) {
    lines.push('', 'Errors:');
    for (const err of validation.errors) lines.push(`  - ${err}`);
  }
  if (validation.warnings.length) {
    lines.push('', 'Warnings:');
    for (const warn of validation.warnings) lines.push(`  - ${warn}`);
  }

  return lines.join('\n');
}
