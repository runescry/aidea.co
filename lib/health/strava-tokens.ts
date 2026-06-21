import { mergeProfile, readProfile } from '@/lib/storage';

export interface StravaConnection {
  athleteId?: number;
  athleteName?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  connectedAt: string;
}

export async function readStravaConnection(): Promise<StravaConnection | null> {
  const profile = await readProfile();
  const conn = profile.integrations as { strava?: StravaConnection } | undefined;
  const raw = conn?.strava;
  if (!raw?.accessToken || !raw.refreshToken) return null;
  return raw;
}

export async function writeStravaConnection(connection: StravaConnection | null): Promise<void> {
  if (!connection) {
    await mergeProfile({ 'integrations.strava': null });
    return;
  }
  await mergeProfile({ 'integrations.strava': connection });
}
