import { readAllKB, writeManyKB } from '@/lib/harness/knowledge-base';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { fetchStravaActivities, getValidStravaAccessToken } from './strava-client';
import { readStravaConnection } from './strava-tokens';
import { readHealthSyncSnapshot, type HealthSyncSnapshot } from './sync';

export async function syncStravaToKb(): Promise<HealthSyncSnapshot> {
  const token = await getValidStravaAccessToken();
  if (!token) throw new Error('Strava not connected');

  const activities = await fetchStravaActivities(token);
  const recentActivities = activities.map(a => ({
    type: a.type || a.name,
    at: a.start_date,
    durationMins: Math.round(a.moving_time / 60),
    notes: a.name,
  }));

  const kb = await readAllKB() as KnowledgeBase;
  await writeManyKB({
    health: {
      ...(kb.health ?? {}),
      sync: {
        provider: 'strava',
        lastSyncedAt: new Date().toISOString(),
        recentActivities,
      },
    },
  });

  return readHealthSyncSnapshot(await readAllKB() as KnowledgeBase);
}

export async function stravaConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  athleteName?: string;
  lastSyncedAt?: string;
}> {
  const conn = await readStravaConnection();
  const kb = await readAllKB() as KnowledgeBase;
  const snapshot = readHealthSyncSnapshot(kb);
  return {
    configured: Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET),
    connected: Boolean(conn),
    athleteName: conn?.athleteName,
    lastSyncedAt: snapshot.lastSyncedAt,
  };
}
