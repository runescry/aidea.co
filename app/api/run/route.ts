import { NextRequest } from 'next/server';
import { getEntityConfig } from '@/lib/entities';
import { resolveDailyEntityConfig } from '@/lib/entities/daily';
import { bootstrapEntity } from '@/lib/harness/bootstrap';
import { hasApiKey } from '@/lib/ai/provider';
import { harnessSSEResponse } from '@/lib/api/sse';

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
  const sessionId = body.sessionId ?? crypto.randomUUID();

  if (!hasApiKey()) {
    return new Response(
      JSON.stringify({ error: 'LLM not configured — set AI_GATEWAY_API_KEY (recommended) or ANTHROPIC_API_KEY in environment' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return harnessSSEResponse(sessionId, async (send) => {
    const entityType = body.entityType ?? 'company';
    const config =
      entityType === 'daily'
        ? resolveDailyEntityConfig(body.input ?? {})
        : getEntityConfig(entityType);
    await bootstrapEntity(config, body.input ?? {}, send, sessionId);
  });
}
