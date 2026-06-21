import { describe, expect, it, vi, beforeEach } from 'vitest';
import { stravaConnectionStatus, syncStravaToKb } from './strava-sync';

vi.mock('./strava-client', () => ({
  getValidStravaAccessToken: vi.fn(async () => 'token'),
  fetchStravaActivities: vi.fn(async () => [{
    id: 1,
    name: 'Morning Run',
    type: 'Run',
    start_date: '2026-06-01T07:00:00.000Z',
    moving_time: 1800,
  }]),
}));

vi.mock('./strava-tokens', () => ({
  readStravaConnection: vi.fn(async () => ({
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: 9999999999,
    connectedAt: '2026-06-01T00:00:00.000Z',
    athleteName: 'Alex',
  })),
}));

vi.mock('@/lib/harness/knowledge-base', () => ({
  readAllKB: vi.fn(async () => ({
    health: {
      sync: {
        provider: 'strava',
        lastSyncedAt: '2026-06-01T08:00:00.000Z',
        recentActivities: [{ type: 'Run', at: '2026-06-01T07:00:00.000Z', durationMins: 30 }],
      },
    },
  })),
  writeManyKB: vi.fn(async () => undefined),
}));

describe('syncStravaToKb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes activities to health.sync', async () => {
    const { writeManyKB } = await import('@/lib/harness/knowledge-base');
    const snapshot = await syncStravaToKb();
    expect(writeManyKB).toHaveBeenCalled();
    expect(snapshot.provider).toBe('strava');
    expect(snapshot.recentActivities[0]?.type).toBe('Run');
  });
});

describe('stravaConnectionStatus', () => {
  it('reports connected athlete', async () => {
    const status = await stravaConnectionStatus();
    expect(status.connected).toBe(true);
    expect(status.athleteName).toBe('Alex');
  });
});
