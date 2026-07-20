import { NextRequest, NextResponse } from 'next/server';

export function checkEvalAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.EVAL_API_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    return NextResponse.json(
      { error: 'Eval API is disabled because EVAL_API_SECRET is not configured' },
      { status: 503 },
    );
  }
  if (secret) {
    const provided = req.headers.get('x-eval-api-secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  return null;
}

export function checkEvalRealWorldMode(
  realWorldMode: string | undefined,
): NextResponse | null {
  if (realWorldMode === 'auto' && process.env.EVAL_ALLOW_LIVE !== '1') {
    return NextResponse.json(
      {
        error: 'realWorldMode auto not allowed on eval routes',
        hint: 'Set EVAL_ALLOW_LIVE=1 to enable live integrations in eval',
      },
      { status: 400 },
    );
  }
  return null;
}
