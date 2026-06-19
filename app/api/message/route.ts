import { NextRequest } from 'next/server';
import type { HarnessEvent } from '@/lib/harness/types';
import { bootstrapEntity } from '@/lib/harness/bootstrap';
import { dispatchEntityConfig } from '@/lib/entities/daily';
import { hasApiKey } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 1800;

export async function POST(req: NextRequest) {
  const body = await req.json() as { command?: string; sessionId?: string };
  const encoder = new TextEncoder();
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

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: HarnessEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      try {
        await bootstrapEntity(dispatchEntityConfig, { command }, send, sessionId);
      } catch (err) {
        send({
          type: 'error',
          sessionId,
          data: { message: err instanceof Error ? err.message : String(err) },
          timestamp: new Date().toISOString(),
        });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
