import { NextRequest } from 'next/server';
import { runOrchestrator } from '@/lib/orchestrator';
import type { RunRequest, SSEEvent } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body: RunRequest = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client disconnected — ignore
        }
      };

      try {
        await runOrchestrator(body, send);
      } catch (err) {
        send({
          type: 'error',
          sessionId: body.sessionId ?? 'unknown',
          cycleNumber: 0,
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
