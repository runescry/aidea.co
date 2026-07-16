import { runAgentHarness, type RunAgentHarnessOptions } from '@/lib/eval/run-agent-harness';
import {
  formatInboxTriageReport,
  validateInboxTriageRun,
  type InboxTriageValidation,
} from './inbox-triage-validate';

const INBOX_TRIAGE_MISSION =
  'Triage unread inbox: score urgency, draft replies for high-urgency emails, return urgent[], actionRequired[], fyi[], draftsQueued';

export interface InboxTriageHarnessOptions {
  realWorldMode?: 'auto' | 'dry-run';
  mission?: string;
  sessionId?: string;
  kbFixture?: RunAgentHarnessOptions['kbFixture'];
  applyOverrides?: boolean;
}

export interface InboxTriageHarnessResult {
  sessionId: string;
  state: Awaited<ReturnType<typeof runAgentHarness>>['state'];
  events: Awaited<ReturnType<typeof runAgentHarness>>['events'];
  inboxTriage: unknown;
  validation: InboxTriageValidation;
  report: string;
}

export function inboxTriageRealWorldMode(): 'auto' | 'dry-run' {
  return process.env.INTEGRATION_GMAIL === '1' ? 'auto' : 'dry-run';
}

/** Run inbox-triage as root agent and validate structured output. */
export async function runInboxTriageHarness(
  options: InboxTriageHarnessOptions = {},
): Promise<InboxTriageHarnessResult> {
  const result = await runAgentHarness({
    agentId: 'inbox-triage',
    mission: options.mission ?? INBOX_TRIAGE_MISSION,
    realWorldMode: options.realWorldMode ?? inboxTriageRealWorldMode(),
    sessionId: options.sessionId,
    kbFixture: options.kbFixture,
    applyOverrides: options.applyOverrides,
  });

  const validation = validateInboxTriageRun(
    result.events,
    result.structured,
    result.state.data,
  );

  return {
    sessionId: result.sessionId,
    state: result.state,
    events: result.events,
    inboxTriage: result.structured,
    validation,
    report: formatInboxTriageReport(validation),
  };
}
