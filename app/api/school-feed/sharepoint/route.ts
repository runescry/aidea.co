import { NextRequest, NextResponse } from 'next/server';
import { listSiteLists, searchSharePointSites } from '@/lib/nango/sharepoint';
import { syncSchoolSharePoint } from '@/lib/harness/school-sharepoint-sync';
import { nangoConfigured, resolveEndUserId } from '@/lib/nango/client';
import { isDemoUserId } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const maxDuration = 120;

function notConnected() {
  return NextResponse.json(
    { error: 'School Microsoft account not connected — use Settings → Connect Microsoft' },
    { status: 503 },
  );
}

/**
 * Discovery for the SharePoint setup UI:
 *   ?sites=<query>   → sites matching the query (blank lists everything visible)
 *   ?siteId=<id>     → that site's non-hidden lists, for picking the news list
 */
export async function GET(req: NextRequest) {
  if (isDemoUserId(await resolveEndUserId())) {
    return NextResponse.json({ sites: [], lists: [] });
  }
  if (!nangoConfigured()) return notConnected();

  const { searchParams } = req.nextUrl;
  const siteId = searchParams.get('siteId');

  try {
    if (siteId) {
      return NextResponse.json({ lists: await listSiteLists(siteId) });
    }
    return NextResponse.json({ sites: await searchSharePointSites(searchParams.get('sites') ?? '') });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Manual "sync now" for SharePoint — the hourly `school-sync` cron runs the same job. */
export async function POST() {
  if (isDemoUserId(await resolveEndUserId())) {
    return NextResponse.json({ ok: true, newsCount: 0, documentCount: 0 });
  }
  if (!nangoConfigured()) return notConnected();

  const result = await syncSchoolSharePoint();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
