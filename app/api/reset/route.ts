import { NextResponse } from 'next/server';
import { clearActivityHistory } from '@/lib/storage';
import { invalidateDevTasksCache } from '@/lib/harness/tasks-cache';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await clearActivityHistory();
    invalidateDevTasksCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reset failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
