import { NextRequest, NextResponse } from 'next/server';
import { hasApiKey } from '@/lib/ai/provider';
import { runFastChatToText } from '@/lib/eval/collect-fast-chat';
import { shouldUseFastChat } from '@/lib/harness/fast-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * EvalKit-compatible JSON adapter for fast-chat only.
 *
 * In scope: greetings, capability questions, planning advice, general chat
 * (same routing as shouldUseFastChat with empty history).
 *
 * Out of scope: inbox/calendar/drafts, profile writes, research, news,
 * queue actions, follow-ups on numbered items — returns 422 full_path_required.
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

  if (!shouldUseFastChat(message, [])) {
    return NextResponse.json(
      {
        error: 'full_path_required',
        hint: 'This eval endpoint only supports fast-chat prompts.',
      },
      { status: 422 },
    );
  }

  try {
    const response = await runFastChatToText(message);
    return NextResponse.json({ response, mode: 'fast' as const });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Fast chat failed';
    return NextResponse.json({ error }, { status: 500 });
  }
}
