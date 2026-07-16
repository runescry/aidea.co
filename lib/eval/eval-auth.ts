import { NextRequest, NextResponse } from 'next/server';

export function checkEvalAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.EVAL_API_SECRET;
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
