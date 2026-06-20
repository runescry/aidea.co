import { describe, expect, it } from 'vitest';
import { readHealthSyncSnapshot, weekTrainingSummary } from './sync';

describe('readHealthSyncSnapshot', () => {
  it('returns sync data from KB', () => {
    expect(readHealthSyncSnapshot({ health: { sync: { provider: 'strava', recentActivities: [] } } }).provider).toBe('strava');
  });
});

describe('weekTrainingSummary', () => {
  it('summarizes week activities', () => {
    const summary = weekTrainingSummary({
      health: { sync: { recentActivities: [{ type: 'Run', at: '2026-06-01T07:00:00.000Z', durationMins: 30 }] } },
    }, new Date('2026-06-02T12:00:00.000Z'));
    expect(summary.totalSessions).toBe(1);
  });
});
