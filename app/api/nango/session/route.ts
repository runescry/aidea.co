import { NextRequest, NextResponse } from 'next/server';
import { getEndUserId, getNango, gmailIntegrationId, calendarIntegrationId, nangoConfigured } from '@/lib/nango/client';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!nangoConfigured()) {
    return NextResponse.json({ error: 'NANGO_SECRET_KEY is not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { integrations?: string[] };
  const allowed = body.integrations?.length
    ? body.integrations
    : [gmailIntegrationId(), calendarIntegrationId()];

  const nango = getNango();
  const { data } = await nango.createConnectSession({
    tags: { end_user_id: getEndUserId() },
    allowed_integrations: allowed,
  });

  return NextResponse.json({ sessionToken: data.token });
}
