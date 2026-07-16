import { NextRequest, NextResponse } from 'next/server';
import { hasApiKey } from '@/lib/ai/provider';
import { runFastChatToText } from '@/lib/eval/collect-fast-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * EvalKit-compatible JSON adapter — always runs fast-chat (no tools).
 *
 * Unlike production `/api/message`, does not pre-filter with shouldUseFastChat.
 * Tool/inbox/calendar/profile requests are refused in natural language by the
 * fast-chat system prompt so eval harnesses can score model behavior.
 */
export async function POST(req: NextRequest) {
  if (!hasApiKey()) {
    return NextResponse.json(
      { error: 'LLM not configured — set AI_GATEWAY_API_KEY (recommended) or ANTHROPIC_API_KEY in environment' },
      { status: 500 },
    );
  }

  let body: { message?: string };
  try {
    body = await req.json() as { message?: string };
  } catch {
    return NextResponse.json({ error: '"message" is required' }, { status: 400 });
  }

  const message = (body.message ?? '').trim();
  if (!message) {
    return NextResponse.json({ error: '"message" is required' }, { status: 400 });
  }

  try {
    const response = await runFastChatToText(message);
    return NextResponse.json({ response, mode: 'fast' as const });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Fast chat failed';
    return NextResponse.json({ error }, { status: 500 });
  }
}
