import { NextRequest } from 'next/server';
import type { HarnessEvent } from '@/lib/harness/types';
import { getEntityConfig } from '@/lib/entities';
import { bootstrapEntity } from '@/lib/harness/bootstrap';
import { hasApiKey } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 1800;

export interface HarnessRunRequest {
  entityType: 'company' | 'personal' | 'learning' | 'creator' | 'daily';
  input: Record<string, unknown>;
  sessionId?: string;
}

export async function POST(req: NextRequest) {
  const body: HarnessRunRequest = await req.json();
  const encoder = new TextEncoder();
  const sessionId = body.sessionId ?? crypto.randomUUID();

  if (!hasApiKey()) {
    return new Response(
      JSON.stringify({ error: 'Anthropic API key not configured — set ANTHROPIC_API_KEY in environment' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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
        const config = getEntityConfig(body.entityType ?? 'company');
        await bootstrapEntity(config, body.input, send, sessionId);
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
