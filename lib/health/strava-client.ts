import {
  stravaClientId,
  stravaClientSecret,
  stravaConfigured,
} from './strava-config';
import { readStravaConnection, writeStravaConnection, type StravaConnection } from './strava-tokens';

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id?: number; firstname?: string; lastname?: string };
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date: string;
  moving_time: number;
}

async function exchangeToken(body: URLSearchParams): Promise<StravaTokenResponse> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Strava token exchange failed (${res.status})`);
  }
  return res.json() as Promise<StravaTokenResponse>;
}

function toConnection(data: StravaTokenResponse): StravaConnection {
  const athleteName = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ') || undefined;
  return {
    athleteId: data.athlete?.id,
    athleteName,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    connectedAt: new Date().toISOString(),
  };
}

export async function connectStravaWithCode(code: string, redirectUri: string): Promise<StravaConnection> {
  if (!stravaConfigured()) throw new Error('Strava is not configured');
  const data = await exchangeToken(new URLSearchParams({
    client_id: stravaClientId(),
    client_secret: stravaClientSecret(),
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  }));
  const connection = toConnection(data);
  await writeStravaConnection(connection);
  return connection;
}

async function refreshStravaToken(refreshToken: string): Promise<StravaConnection> {
  const data = await exchangeToken(new URLSearchParams({
    client_id: stravaClientId(),
    client_secret: stravaClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }));
  const existing = await readStravaConnection();
  const connection = { ...toConnection(data), connectedAt: existing?.connectedAt ?? new Date().toISOString() };
  await writeStravaConnection(connection);
  return connection;
}

export async function getValidStravaAccessToken(): Promise<string | null> {
  const conn = await readStravaConnection();
  if (!conn) return null;
  if (conn.expiresAt > Math.floor(Date.now() / 1000) + 60) return conn.accessToken;
  if (!stravaConfigured()) return null;
  const refreshed = await refreshStravaToken(conn.refreshToken);
  return refreshed.accessToken;
}

export async function fetchStravaActivities(accessToken: string, limit = 20): Promise<StravaActivity[]> {
  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava activities fetch failed (${res.status})`);
  return res.json() as Promise<StravaActivity[]>;
}
