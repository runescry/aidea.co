import { NextRequest } from 'next/server';
import { bootstrapEntity } from '@/lib/harness/bootstrap';
import { dispatchEntityConfig } from '@/lib/entities/daily';
import { hasApiKey } from '@/lib/ai/provider';
import { harnessSSEResponse } from '@/lib/api/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 1800;

export async function POST(req: NextRequest) {
  const body = await req.json() as { command?: string; sessionId?: string };
  const sessionId = body.sessionId ?? crypto.randomUUID();

  if (!hasApiKey()) {
    return new Response(
      JSON.stringify({ error: 'Anthropic API key not configured — set ANTHROPIC_API_KEY in environment' }),
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

  return harnessSSEResponse(sessionId, async (send) => {
    await bootstrapEntity(dispatchEntityConfig, { command }, send, sessionId);
  });
}
