import { NextResponse } from 'next/server';
import { enrichBriefMustDoFromGmail } from '@/lib/harness/morning-brief-enrich';
import { normalizeMorningBrief } from '@/lib/harness/morning-brief-must-do';
import { readLatestBrief } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET() {
  const brief = await readLatestBrief();
  if (!brief) {
    return NextResponse.json({ brief: null });
  }
  const enriched = await enrichBriefMustDoFromGmail(brief);
  return NextResponse.json({
    brief: enriched ? normalizeMorningBrief(enriched) : null,
  });
}
