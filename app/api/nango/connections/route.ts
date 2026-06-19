import { NextRequest, NextResponse } from 'next/server';
import { deleteNangoConnection, listNangoConnections } from '@/lib/nango/connections';
import { nangoConfigured } from '@/lib/nango/client';

export const runtime = 'nodejs';

export async function GET() {
  if (!nangoConfigured()) {
    return NextResponse.json({ configured: false, connections: [] });
  }

  const connections = await listNangoConnections();
  return NextResponse.json({ configured: true, connections });
}

export async function DELETE(req: NextRequest) {
  const connectionId = req.nextUrl.searchParams.get('connectionId');
  const integrationId = req.nextUrl.searchParams.get('integrationId');
  if (!connectionId || !integrationId) {
    return NextResponse.json({ error: 'connectionId and integrationId required' }, { status: 400 });
  }

  await deleteNangoConnection(connectionId, integrationId);
  return NextResponse.json({ ok: true, connections: await listNangoConnections() });
}
