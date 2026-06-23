import { NextRequest, NextResponse } from 'next/server';
import { AGENT_LIBRARY } from '@/lib/agents/library';
import { checkEvalAuth } from '@/lib/eval/eval-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function contractSummary(systemPrompt: string): string {
  const line = systemPrompt.split('\n').find(l => l.trim().length > 0)?.trim() ?? '';
  return line.length > 200 ? `${line.slice(0, 197)}…` : line;
}

/** Catalog for EvalKit fixture generation. */
export async function GET(req: NextRequest) {
  const authError = checkEvalAuth(req);
  if (authError) return authError;

  const agents = Object.values(AGENT_LIBRARY).map(def => ({
    id: def.id,
    displayName: def.displayName,
    authority: def.authority,
    defaultTools: def.defaultTools,
    stateWriteKey: def.stateWriteKey,
    contractSummary: contractSummary(def.systemPrompt),
  }));

  return NextResponse.json({ agents });
}
