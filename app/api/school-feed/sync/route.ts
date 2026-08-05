import { NextResponse } from 'next/server';
import { syncSchoolFeed } from '@/lib/harness/school-feed-sync';
import { readAllKB } from '@/lib/harness/knowledge-base';
import type { KnowledgeBase } from '@/types/knowledge-base';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  const { inbox: inboxResult, calendar: calendarResult } = await syncSchoolFeed();

  const kb = await readAllKB() as KnowledgeBase;
  const feed = kb.family?.schoolFeed ?? null;
  const ok = inboxResult.ok || calendarResult.ok;

  if (!ok) {
    return NextResponse.json(
      {
        ok: false,
        inbox: inboxResult,
        calendar: calendarResult,
        feed,
        error: calendarResult.error ?? inboxResult.error ?? 'School sync failed',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    inbox: inboxResult,
    calendar: calendarResult,
    feed,
  });
}
