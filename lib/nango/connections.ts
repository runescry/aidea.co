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
  displayName?: string;
  createdAt?: string;
}

type ListedConnection = {
  connection_id: string;
  provider_config_key: string;
  created?: string;
  metadata?: Record<string, unknown> | null;
  end_user?: { email?: string | null; display_name?: string | null } | null;
  tags?: Record<string, string>;
};

function tagEmail(tags?: Record<string, string>): string | undefined {
  return tags?.end_user_email || tags?.end_user_email_address;
}

async function fetchGoogleIdentity(
  integrationId: string,
  connectionId: string,
): Promise<{ email?: string; displayName?: string }> {
  const nango = getNango();
  try {
    const res = await nango.get<{ email?: string; name?: string; emailAddress?: string }>({
      providerConfigKey: integrationId,
      connectionId,
      endpoint: '/oauth2/v2/userinfo',
      baseUrlOverride: 'https://www.googleapis.com',
    });
    return {
      email: res.data.email ?? res.data.emailAddress,
      displayName: res.data.name,
    };
  } catch {
    if (integrationId !== gmailIntegrationId()) return {};
    try {
      const res = await nango.get<{ emailAddress?: string }>({
        providerConfigKey: integrationId,
        connectionId,
        endpoint: '/gmail/v1/users/me/profile',
        baseUrlOverride: 'https://www.googleapis.com',
      });
      return { email: res.data.emailAddress };
    } catch {
      return {};
    }
  }
}

async function enrichConnection(conn: ListedConnection): Promise<NangoConnectionPublic> {
  const nango = getNango();
  let email =
    conn.end_user?.email
    ?? tagEmail(conn.tags)
    ?? (typeof conn.metadata?.email === 'string' ? conn.metadata.email : undefined);
  let displayName = conn.end_user?.display_name ?? undefined;

  if (!email) {
    try {
      const full = await nango.getConnection(conn.provider_config_key, conn.connection_id);
      email = full.end_user?.email ?? tagEmail(full.tags) ?? email;
      displayName = full.end_user?.display_name ?? displayName;
      const raw = (full.credentials as { raw?: { email?: string; name?: string } } | undefined)?.raw;
      email = email ?? raw?.email;
      displayName = displayName ?? raw?.name;
    } catch {
      // fall through to Google profile fetch
    }
  }

  if (!email) {
    const profile = await fetchGoogleIdentity(conn.provider_config_key, conn.connection_id);
    email = profile.email ?? email;
    displayName = displayName ?? profile.displayName;
  }

  if (email && !conn.metadata?.email) {
    try {
      await nango.setMetadata(conn.provider_config_key, conn.connection_id, {
        ...(conn.metadata ?? {}),
        email,
        ...(displayName ? { displayName } : {}),
      });
    } catch {
      // non-fatal — listing still works
    }
  }

  return {
    connectionId: conn.connection_id,
    integrationId: conn.provider_config_key,
    email: email ?? undefined,
    displayName: displayName ?? undefined,
    createdAt: conn.created,
  };
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
  const filtered = connections.filter(
    c => !integrationId || c.provider_config_key === integrationId,
  ) as ListedConnection[];

  return Promise.all(filtered.map(enrichConnection));
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
