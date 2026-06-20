import { dailyEntityConfig } from '@/lib/entities/daily';
import { hasApiKey } from '@/lib/ai/provider';
import { bootstrapEntity, type BootstrapOptions } from './bootstrap';
import {
  formatInboxTriageReport,
  validateInboxTriageRun,
  type InboxTriageValidation,
} from './inbox-triage-validate';
import type { EntityConfig, EntityState, HarnessEvent } from './types';

const INBOX_TRIAGE_MISSION =
  'Triage unread inbox: score urgency, draft replies for high-urgency emails, return urgent[], actionRequired[], fyi[], draftsQueued';

function inboxTriageHarnessConfig(
  realWorldToolMode: 'auto' | 'dry-run',
  mission = INBOX_TRIAGE_MISSION,
): EntityConfig {
  return {
    ...dailyEntityConfig,
    rootAgentId: 'inbox-triage',
    mission: 'Triage unread Gmail and surface what needs attention today.',
    buildInitialTask: () => ({
      description: mission,
      contextKeys: [],
    }),
    costConfig: {
      ...dailyEntityConfig.costConfig!,
      realWorldToolMode,
    },
  };
}

export interface InboxTriageHarnessOptions {
  /** Force dry-run mocks or live Gmail via Nango. Default: dry-run unless INTEGRATION_GMAIL=1 */
  realWorldMode?: 'auto' | 'dry-run';
  mission?: string;
  sessionId?: string;
}

export interface InboxTriageHarnessResult {
  sessionId: string;
  state: EntityState;
  events: HarnessEvent[];
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
  if (!hasApiKey()) {
    throw new Error('LLM not configured — set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY in .env.local');
  }

  const sessionId = options.sessionId ?? crypto.randomUUID();
  const realWorldMode = options.realWorldMode ?? inboxTriageRealWorldMode();
  const events: HarnessEvent[] = [];
  const send = (event: HarnessEvent) => events.push(event);

  const config = inboxTriageHarnessConfig(realWorldMode, options.mission);
  const bootstrapOpts: BootstrapOptions = { realWorldMode };

  const state = await bootstrapEntity(config, {}, send, sessionId, bootstrapOpts);
  const inboxTriage = state.data.inbox_triage;
  const validation = validateInboxTriageRun(events, inboxTriage, state.data);

  return {
    sessionId,
    state,
    events,
    inboxTriage,
    validation,
    report: formatInboxTriageReport(validation),
  };
}
