import {
  getEndUserId,
  getNango,
  gmailIntegrationId,
  calendarIntegrationId,
  nangoConfigured,
} from './client';

export interface NangoConnectionPublic {
  connectionId: string;
  integrationId: string;
  email?: string;
  createdAt?: string;
}

export async function hasNangoConnections(): Promise<boolean> {
  if (!nangoConfigured()) return false;
  const list = await listNangoConnections();
  return list.length > 0;
}

export async function listNangoConnections(integrationId?: string): Promise<NangoConnectionPublic[]> {
  const nango = getNango();
  const res = await nango.listConnections({
    tags: { end_user_id: getEndUserId() },
  });

  const connections = res.connections ?? [];
  return connections
    .filter(c => !integrationId || c.provider_config_key === integrationId)
    .map(c => ({
      connectionId: c.connection_id,
      integrationId: c.provider_config_key,
      email: (c as { end_user?: { email?: string } }).end_user?.email
        ?? (c.metadata as { email?: string } | undefined)?.email,
      createdAt: c.created,
    }));
}

export async function listGmailConnections(): Promise<NangoConnectionPublic[]> {
  return listNangoConnections(gmailIntegrationId());
}

export async function listCalendarConnections(): Promise<NangoConnectionPublic[]> {
  return listNangoConnections(calendarIntegrationId());
}

export async function resolveGmailConnections(connectionId?: string): Promise<NangoConnectionPublic[]> {
  const all = await listGmailConnections();
  if (all.length === 0) {
    throw new Error('Gmail not connected — use Settings → Connect Google Mail');
  }
  if (!connectionId) return all;
  const match = all.find(c => c.connectionId === connectionId);
  if (!match) {
    throw new Error(`No Gmail connection ${connectionId}. Connected: ${all.map(c => c.connectionId).join(', ')}`);
  }
  return [match];
}

export async function resolveCalendarConnections(connectionId?: string): Promise<NangoConnectionPublic[]> {
  const all = await listCalendarConnections();
  if (all.length === 0) {
    throw new Error('Google Calendar not connected — use Settings → Connect Google Calendar');
  }
  if (!connectionId) return all;
  const match = all.find(c => c.connectionId === connectionId);
  if (!match) throw new Error(`No calendar connection ${connectionId}`);
  return [match];
}

export async function deleteNangoConnection(connectionId: string, integrationId: string): Promise<void> {
  const nango = getNango();
  await nango.deleteConnection(integrationId, connectionId);
}
