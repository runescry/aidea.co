import type { HarnessEvent } from '@/lib/harness/types';

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

export function createHarnessSSEStream(
  sessionId: string,
  run: (send: (event: HarnessEvent) => void) => Promise<void>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      // Pad the stream so proxies (Vercel/nginx) flush early — avoids silent SSE buffering.
      try {
        controller.enqueue(encoder.encode(`: ${' '.repeat(2048)}\n\n`));
      } catch {
        // client disconnected
      }

      const send = (event: HarnessEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      try {
        await run(send);
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
}

export function harnessSSEResponse(
  sessionId: string,
  run: (send: (event: HarnessEvent) => void) => Promise<void>,
): Response {
  return new Response(createHarnessSSEStream(sessionId, run), { headers: SSE_HEADERS });
}
