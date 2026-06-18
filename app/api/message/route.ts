import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { HarnessEvent } from '@/lib/harness/types';
import { bootstrapEntity } from '@/lib/harness/bootstrap';
import { dispatchEntityConfig } from '@/lib/entities/daily';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json() as { command?: string; sessionId?: string };
  const encoder = new TextEncoder();
  const sessionId = body.sessionId ?? crypto.randomUUID();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }),
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
        const client = new Anthropic({ apiKey });
        await bootstrapEntity(client, dispatchEntityConfig, { command }, send, sessionId);
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
