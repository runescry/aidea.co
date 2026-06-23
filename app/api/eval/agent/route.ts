import { NextRequest, NextResponse } from 'next/server';
import { hasApiKey } from '@/lib/ai/provider';
import { runAgentHarness } from '@/lib/eval/run-agent-harness';
import { checkEvalAuth, checkEvalRealWorldMode } from '@/lib/eval/eval-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * EvalKit harness-json adapter — runs a single library agent in dry-run by default.
 * See docs/API.md for request/response contract.
 */
export async function POST(req: NextRequest) {
  const authError = checkEvalAuth(req);
  if (authError) return authError;

  if (!hasApiKey()) {
    return NextResponse.json(
      { error: 'LLM not configured — set AI_GATEWAY_API_KEY (recommended) or ANTHROPIC_API_KEY in environment' },
      { status: 500 },
    );
  }

  let body: {
    agentId?: string;
    mission?: string;
    realWorldMode?: 'auto' | 'dry-run';
    applyOverrides?: boolean;
    kbFixture?: Record<string, unknown>;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const agentId = (body.agentId ?? '').trim();
  const mission = (body.mission ?? '').trim();
  const realWorldMode = body.realWorldMode ?? 'dry-run';

  if (!agentId) {
    return NextResponse.json({ error: '"agentId" is required' }, { status: 400 });
  }
  if (!mission) {
    return NextResponse.json({ error: '"mission" is required' }, { status: 400 });
  }

  const modeError = checkEvalRealWorldMode(realWorldMode);
  if (modeError) return modeError;

  try {
    const result = await runAgentHarness({
      agentId,
      mission,
      realWorldMode,
      applyOverrides: body.applyOverrides ?? false,
      kbFixture: body.kbFixture,
    });

    return NextResponse.json({
      agentId: result.agentId,
      mode: result.mode,
      realWorldMode: result.realWorldMode,
      response: result.response,
      structured: result.structured,
      stateWriteKey: result.stateWriteKey,
      toolsCalled: result.toolsCalled,
      toolCalls: result.toolCalls,
      validation: result.validation,
      cost: {
        estimatedUSD: result.cost.estimatedUSD ?? 0,
        agentCount: result.cost.agentCount ?? 1,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent harness failed';
    const status = message.includes('Unknown agentId') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
