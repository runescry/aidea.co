import { NextRequest, NextResponse } from 'next/server';
import {
  deleteNangoConnection,
  listNangoConnections,
  listNangoConnectionsLite,
  invalidateNangoConnectionsCache,
} from '@/lib/nango/connections';
import { nangoConfigured, resolveEndUserId } from '@/lib/nango/client';
import { isDemoUserId } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (isDemoUserId(await resolveEndUserId())) {
    return NextResponse.json({ configured: true, connections: [] });
  }

  if (!nangoConfigured()) {
    return NextResponse.json({ configured: false, connections: [] });
  }

  const lite = req.nextUrl.searchParams.get('lite') === '1';
  const connections = lite ? await listNangoConnectionsLite() : await listNangoConnections();
  return NextResponse.json({ configured: true, connections });
}

export async function DELETE(req: NextRequest) {
  const connectionId = req.nextUrl.searchParams.get('connectionId');
  const integrationId = req.nextUrl.searchParams.get('integrationId');
  if (!connectionId || !integrationId) {
    return NextResponse.json({ error: 'connectionId and integrationId required' }, { status: 400 });
  }

  try {
    await deleteNangoConnection(connectionId, integrationId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection not found for current user';
    return NextResponse.json({ error: message }, { status: 404 });
  }
  invalidateNangoConnectionsCache();
  return NextResponse.json({ ok: true, connections: await listNangoConnections() });
}
