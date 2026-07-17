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

function endUserTag(conn: ListedConnection): string {
  return conn.tags?.end_user_id ?? getEndUserId();
}

async function persistConnectionMetadata(
  conn: ListedConnection,
  email: string,
  displayName?: string,
): Promise<void> {
  if (conn.metadata?.email === email) return;
  try {
    const nango = getNango();
    await nango.setMetadata(conn.provider_config_key, conn.connection_id, {
      ...(conn.metadata ?? {}),
      email,
      ...(displayName ? { displayName } : {}),
    });
  } catch {
    // non-fatal
  }
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
  let displayName =
    (typeof conn.metadata?.displayName === 'string' ? conn.metadata.displayName : undefined)
    ?? conn.end_user?.display_name
    ?? undefined;

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

  if (email) {
    await persistConnectionMetadata(conn, email, displayName);
  }

  return {
    connectionId: conn.connection_id,
    integrationId: conn.provider_config_key,
    email: email ?? undefined,
    displayName: displayName ?? undefined,
    createdAt: conn.created,
  };
}

/** Calendar tokens often lack email scope — borrow identity from Gmail on the same end user. */
async function enrichConnections(conns: ListedConnection[]): Promise<NangoConnectionPublic[]> {
  const results = await Promise.all(conns.map(enrichConnection));

  const identityByTag = new Map<string, { email: string; displayName?: string }>();
  for (let i = 0; i < results.length; i++) {
    if (!results[i].email) continue;
    identityByTag.set(endUserTag(conns[i]), {
      email: results[i].email!,
      displayName: results[i].displayName,
    });
  }

  for (let i = 0; i < results.length; i++) {
    if (results[i].email) continue;
    const sibling = identityByTag.get(endUserTag(conns[i]));
    if (!sibling) continue;

    results[i] = {
      ...results[i],
      email: sibling.email,
      displayName: results[i].displayName ?? sibling.displayName,
    };
    await persistConnectionMetadata(conns[i], sibling.email, results[i].displayName);
  }

  return results;
}

let _hasConnectionsCache: { at: number; value: boolean } | null = null;
const NANGO_HAS_CONNECTIONS_MS = 60_000;

export function invalidateNangoConnectionsCache(): void {
  _hasConnectionsCache = null;
}

export async function hasNangoConnections(): Promise<boolean> {
  if (!nangoConfigured()) return false;
  const now = Date.now();
  if (_hasConnectionsCache && now - _hasConnectionsCache.at < NANGO_HAS_CONNECTIONS_MS) {
    return _hasConnectionsCache.value;
  }
  const nango = getNango();
  const res = await nango.listConnections({ tags: { end_user_id: getEndUserId() } });
  const value = (res.connections ?? []).length > 0;
  _hasConnectionsCache = { at: now, value };
  return value;
}

function mapConnectionLite(conn: ListedConnection): NangoConnectionPublic {
  const email =
    conn.end_user?.email
    ?? tagEmail(conn.tags)
    ?? (typeof conn.metadata?.email === 'string' ? conn.metadata.email : undefined);
  const displayName =
    (typeof conn.metadata?.displayName === 'string' ? conn.metadata.displayName : undefined)
    ?? conn.end_user?.display_name
    ?? undefined;

  return {
    connectionId: conn.connection_id,
    integrationId: conn.provider_config_key,
    email: email ?? undefined,
    displayName: displayName ?? undefined,
    createdAt: conn.created,
  };
}

/** Fast path for tool calls — no Google profile enrichment. */
export async function listNangoConnectionsLite(
  integrationId?: string,
): Promise<NangoConnectionPublic[]> {
  const nango = getNango();
  const res = await nango.listConnections({ tags: { end_user_id: getEndUserId() } });
  const connections = (res.connections ?? []) as ListedConnection[];
  return connections
    .filter(c => !integrationId || c.provider_config_key === integrationId)
    .map(mapConnectionLite);
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

  return enrichConnections(filtered);
}

export async function listGmailConnections(): Promise<NangoConnectionPublic[]> {
  return listNangoConnections(gmailIntegrationId());
}

export async function listGmailConnectionsLite(): Promise<NangoConnectionPublic[]> {
  return listNangoConnectionsLite(gmailIntegrationId());
}

export async function listCalendarConnections(): Promise<NangoConnectionPublic[]> {
  return listNangoConnections(calendarIntegrationId());
}

export async function listCalendarConnectionsLite(): Promise<NangoConnectionPublic[]> {
  return listNangoConnectionsLite(calendarIntegrationId());
}

export async function resolveGmailConnections(connectionId?: string): Promise<NangoConnectionPublic[]> {
  const all = await listGmailConnectionsLite();
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
  const all = await listCalendarConnectionsLite();
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
