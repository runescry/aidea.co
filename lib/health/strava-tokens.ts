import {
  mergeProfile,
  readIntegrationCredential,
  readProfile,
  writeIntegrationCredential,
} from '@/lib/storage';

export interface StravaConnection {
  athleteId?: number;
  athleteName?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  connectedAt: string;
}

export async function readStravaConnection(): Promise<StravaConnection | null> {
  const stored = await readIntegrationCredential<StravaConnection>('strava');
  if (stored?.accessToken && stored.refreshToken) return stored;

  // One-time migration from the legacy profile-embedded credential.
  const profile = await readProfile();
  const conn = profile.integrations as { strava?: StravaConnection } | undefined;
  const raw = conn?.strava;
  if (!raw?.accessToken || !raw.refreshToken) return null;
  await writeIntegrationCredential('strava', raw);
  await mergeProfile({ 'integrations.strava': null });
  return raw;
}

export async function writeStravaConnection(connection: StravaConnection | null): Promise<void> {
  if (!connection) {
    await writeIntegrationCredential('strava', null);
    await mergeProfile({ 'integrations.strava': null });
    return;
  }
  await writeIntegrationCredential('strava', connection);
  await mergeProfile({
    'integrations.strava': {
      athleteId: connection.athleteId,
      athleteName: connection.athleteName,
      connectedAt: connection.connectedAt,
    },
  });
}
