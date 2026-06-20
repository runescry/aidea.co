import { NextRequest } from 'next/server';
import { bootstrapEntity } from '@/lib/harness/bootstrap';
import { dispatchEntityConfig } from '@/lib/entities/daily';
import { hasApiKey } from '@/lib/ai/provider';
import { harnessSSEResponse } from '@/lib/api/sse';
import type { ChatHistoryEntry } from '@/types/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 1800;

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    command?: string;
    sessionId?: string;
    history?: ChatHistoryEntry[];
  };
  const sessionId = body.sessionId ?? crypto.randomUUID();

  if (!hasApiKey()) {
    return new Response(
      JSON.stringify({ error: 'LLM not configured — set AI_GATEWAY_API_KEY (recommended) or ANTHROPIC_API_KEY in environment' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const command = (body.command ?? '').trim();
  if (!command) {
    return new Response(
      JSON.stringify({ error: '"command" is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const history = Array.isArray(body.history) ? body.history.slice(-16) : [];

  return harnessSSEResponse(sessionId, async (send) => {
    await bootstrapEntity(
      dispatchEntityConfig,
      { command, history },
      send,
      sessionId,
    );
  });
}
