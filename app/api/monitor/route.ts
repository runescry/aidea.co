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

export const runtime = 'nodejs';
export const maxDuration = 1800;

const MONITORS: Record<string, string> = {
  daily: 'daily-orchestrator',
  inbox: 'inbox-triage',
  calendar: 'calendar-reader',
  relationships: 'relationship-monitor',
};

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') ?? 'daily';

  if (!MONITORS[name]) {
    return NextResponse.json({ error: `Unknown monitor: ${name}` }, { status: 400 });
  }

  if (!hasApiKey()) {
    return NextResponse.json(
      { error: 'LLM not configured — set AI_GATEWAY_API_KEY (recommended) or ANTHROPIC_API_KEY in environment' },
      { status: 500 }
    );
  }

  // Inbox and daily monitors need Gmail — skip gracefully if not connected.
  if (name === 'inbox' || name === 'daily') {
    const gmailConns = nangoConfigured() ? await listGmailConnectionsLite() : [];
    if (gmailConns.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no Gmail connection', eventCount: 0 });
    }
  }

  // Relationship monitor needs at least some integration — skip if none.
  if (name === 'relationships') {
    if (!(await hasNangoConnections())) {
      return NextResponse.json({ ok: true, skipped: 'no integrations connected', eventCount: 0 });
    }
  }

  const events: HarnessEvent[] = [];
  const send = (e: HarnessEvent) => events.push(e);
  const sessionId = crypto.randomUUID();

  try {
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

    return NextResponse.json({ ok: true, eventCount: events.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
