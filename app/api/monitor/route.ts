import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { HarnessEvent } from '@/lib/harness/types';
import { bootstrapEntity } from '@/lib/harness/bootstrap';
import { dailyEntityConfig } from '@/lib/entities/daily';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MONITORS: Record<string, string> = {
  daily: 'daily-orchestrator',
  inbox: 'inbox-triage',
  calendar: 'calendar-reader',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') ?? 'daily';

  if (!MONITORS[name]) {
    return NextResponse.json({ error: `Unknown monitor: ${name}` }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
  }

  const events: HarnessEvent[] = [];
  const send = (e: HarnessEvent) => events.push(e);
  const sessionId = crypto.randomUUID();

  try {
    const client = new Anthropic({ apiKey });
    const config = {
      ...dailyEntityConfig,
      rootAgentId: MONITORS[name],
    };
    await bootstrapEntity(client, config, {}, send, sessionId);
    return NextResponse.json({ ok: true, eventCount: events.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
