import { NextRequest, NextResponse } from 'next/server';
import {
  getEndUserId,
  getNango,
  gmailIntegrationId,
  calendarIntegrationId,
  nangoConfigured,
  nangoMisconfigMessage,
} from '@/lib/nango/client';

export const runtime = 'nodejs';

function nangoErrorMessage(err: unknown): string {
  const axios = err as {
    response?: { data?: { error?: { message?: string; code?: string }; message?: string } };
    message?: string;
  };
  return (
    axios.response?.data?.error?.message
    ?? axios.response?.data?.message
    ?? (err instanceof Error ? err.message : String(err))
  );
}

export async function POST(req: NextRequest) {
  if (!nangoConfigured()) {
    return NextResponse.json({ error: nangoMisconfigMessage() }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({})) as { integrations?: string[] };
    const requested = body.integrations?.length
      ? body.integrations
      : [gmailIntegrationId(), calendarIntegrationId()];

    const nango = getNango();
    const { configs } = await nango.listIntegrations();
    const available = new Set(configs.map(c => c.unique_key));
    const allowed = requested.filter(id => available.has(id));

    if (allowed.length === 0) {
      const availableList = [...available].sort().join(', ') || 'none';
      return NextResponse.json({
        error: `No matching Nango integrations. This app expects: ${requested.join(', ')}. Your Nango environment has: ${availableList}. Create integrations with those keys in app.nango.dev, or set NANGO_GMAIL_INTEGRATION_ID / NANGO_CALENDAR_INTEGRATION_ID in Vercel env vars.`,
      }, { status: 400 });
    }

    const { data } = await nango.createConnectSession({
      tags: { end_user_id: getEndUserId() },
      allowed_integrations: allowed,
    });

    return NextResponse.json({
      sessionToken: data.token,
      integrations: allowed,
    });
  } catch (err) {
    const message = nangoErrorMessage(err);
    console.error('[nango/session]', message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
