import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReadCredential = vi.fn();
const mockWriteCredential = vi.fn();
const mockMergeProfile = vi.fn();
const mockReadProfile = vi.fn();

vi.mock('@/lib/storage', () => ({
  readIntegrationCredential: (...args: unknown[]) => mockReadCredential(...args),
  writeIntegrationCredential: (...args: unknown[]) => mockWriteCredential(...args),
  mergeProfile: (...args: unknown[]) => mockMergeProfile(...args),
  readProfile: (...args: unknown[]) => mockReadProfile(...args),
}));

import { readStravaConnection, writeStravaConnection, type StravaConnection } from './strava-tokens';

const connection: StravaConnection = {
  athleteId: 42,
  athleteName: 'Runner',
  accessToken: 'access-secret',
  refreshToken: 'refresh-secret',
  expiresAt: 123,
  connectedAt: '2026-07-20T00:00:00.000Z',
};

describe('Strava credential storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadCredential.mockResolvedValue(null);
    mockReadProfile.mockResolvedValue({});
  });

  it('stores secrets outside the profile and keeps only safe metadata in it', async () => {
    await writeStravaConnection(connection);
    expect(mockWriteCredential).toHaveBeenCalledWith('strava', connection);
    expect(mockMergeProfile).toHaveBeenCalledWith({
      'integrations.strava': {
        athleteId: 42,
        athleteName: 'Runner',
        connectedAt: connection.connectedAt,
      },
    });
  });

  it('migrates a legacy profile-embedded credential on read', async () => {
    mockReadProfile.mockResolvedValue({ integrations: { strava: connection } });
    await expect(readStravaConnection()).resolves.toEqual(connection);
    expect(mockWriteCredential).toHaveBeenCalledWith('strava', connection);
    expect(mockMergeProfile).toHaveBeenCalledWith({ 'integrations.strava': null });
  });
});
