import { NextRequest, NextResponse } from 'next/server';
import type { HarnessEvent } from '@/lib/harness/types';
import { bootstrapEntity } from '@/lib/harness/bootstrap';
import { dailyEntityConfig, dailyLiteEntityConfig, inboxLiteEntityConfig } from '@/lib/entities/daily';
import { hasApiKey } from '@/lib/ai/provider';
import { writeLatestBrief } from '@/lib/storage';
import { collapsePendingQueueDuplicates } from '@/lib/harness/queue';
import { recordRelationshipMonitorSignals } from '@/lib/contacts/sync-signals';
import { listGmailConnectionsLite, hasNangoConnections } from '@/lib/nango/connections';
import { nangoConfigured } from '@/lib/nango/client';
import { listMonitorTargets } from '@/lib/auth/accounts';
import { runWithUserContext } from '@/lib/auth/user-context';

export const runtime = 'nodejs';
export const maxDuration = 1800;

type MonitorResult = {
  status: 'complete' | 'skipped' | 'error';
  eventCount: number;
  reason?: string;
};

const MONITORS = {
  daily: 'daily-orchestrator',
  inbox: 'inbox-triage',
  calendar: 'calendar-reader',
  relationships: 'relationship-monitor',
} as const;

type MonitorName = keyof typeof MONITORS;

function isMonitorName(value: string): value is MonitorName {
  return value in MONITORS;
}

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

async function runMonitor(name: MonitorName): Promise<MonitorResult> {
  const events: HarnessEvent[] = [];
  try {
    // Inbox and daily monitors need Gmail — skip gracefully if not connected.
    if (name === 'inbox' || name === 'daily') {
      const gmailConns = nangoConfigured() ? await listGmailConnectionsLite() : [];
      if (gmailConns.length === 0) {
        return { status: 'skipped', reason: 'no Gmail connection', eventCount: 0 };
      }
    }

    // Relationship monitor needs at least some integration — skip if none.
    if (name === 'relationships' && !(await hasNangoConnections())) {
      return { status: 'skipped', reason: 'no integrations connected', eventCount: 0 };
    }

    const send = (e: HarnessEvent) => events.push(e);
    const sessionId = crypto.randomUUID();
    const config =
      name === 'daily'
        ? dailyLiteEntityConfig
        : name === 'inbox'
          ? inboxLiteEntityConfig
          : {
              ...dailyEntityConfig,
              rootAgentId: MONITORS[name],
            };
    const state = await bootstrapEntity(config, {}, send, sessionId);

    if (name === 'daily' && state.data.morning_brief) {
      await writeLatestBrief(state.data.morning_brief as Record<string, unknown>);
    }

    if (name === 'relationships' && state.data.relationship_monitor) {
      const monitor = state.data.relationship_monitor as {
        coolingRelationships?: Array<{ name?: string; email?: string; weeksSince?: number }>;
      };
      await recordRelationshipMonitorSignals(monitor.coolingRelationships ?? []).catch(() => undefined);
    }

    if (name === 'inbox') {
      await collapsePendingQueueDuplicates().catch(() => undefined);
    }

    return { status: 'complete', eventCount: events.length };
  } catch (err) {
    return {
      status: 'error',
      eventCount: events.length,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedName = searchParams.get('name') ?? 'daily';
  if (!isMonitorName(requestedName)) {
    return NextResponse.json({ error: `Unknown monitor: ${requestedName}` }, { status: 400 });
  }

  if (!hasApiKey()) {
    return NextResponse.json(
      { error: 'LLM not configured — set AI_GATEWAY_API_KEY (recommended) or ANTHROPIC_API_KEY in environment' },
      { status: 500 },
    );
  }

  const targets = await listMonitorTargets();
  const results: MonitorResult[] = [];
  for (const target of targets) {
    results.push(await runWithUserContext(target, () => runMonitor(requestedName)));
  }

  return NextResponse.json({
    ok: results.every(result => result.status !== 'error'),
    processed: results.filter(result => result.status === 'complete').length,
    skipped: results.filter(result => result.status === 'skipped').length,
    failed: results.filter(result => result.status === 'error').length,
    eventCount: results.reduce((sum, result) => sum + result.eventCount, 0),
  });
}
