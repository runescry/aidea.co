import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRegisteredNangoUserId: vi.fn(),
  setCurrentGoogleUser: vi.fn(),
  hasGoogleConnectionsForEndUser: vi.fn(),
  mergeProfile: vi.fn(),
}));

vi.mock('@/lib/auth/accounts', () => ({
  getRegisteredNangoUserId: mocks.getRegisteredNangoUserId,
}));
vi.mock('@/lib/auth/session', () => ({
  normalizeUserId: (value: string | null) => value,
  setCurrentGoogleUser: mocks.setCurrentGoogleUser,
}));
vi.mock('@/lib/nango/connections', () => ({
  hasGoogleConnectionsForEndUser: mocks.hasGoogleConnectionsForEndUser,
  invalidateNangoConnectionsCache: vi.fn(),
}));
vi.mock('@/lib/storage', () => ({ mergeProfile: mocks.mergeProfile }));

import { POST } from './route';

describe('POST /api/auth/google/resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRegisteredNangoUserId.mockResolvedValue('google:existing-nango');
    mocks.hasGoogleConnectionsForEndUser.mockResolvedValue(true);
    mocks.setCurrentGoogleUser.mockResolvedValue(undefined);
    mocks.mergeProfile.mockResolvedValue(undefined);
  });

  it('restores a verified session when connections exist', async () => {
    const userId = 'google:abc123';
    const res = await POST(new Request('http://localhost/api/auth/google/resume', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }));
    const body = await res.json() as { ok: boolean; resumed: boolean };

    expect(res.status).toBe(200);
    expect(body.resumed).toBe(true);
    expect(mocks.setCurrentGoogleUser).toHaveBeenCalledWith(userId, 'google:existing-nango');
  });

  it('requires reconnect when connections are missing', async () => {
    mocks.hasGoogleConnectionsForEndUser.mockResolvedValue(false);
    const res = await POST(new Request('http://localhost/api/auth/google/resume', {
      method: 'POST',
      body: JSON.stringify({ userId: 'google:abc123' }),
    }));

    expect(res.status).toBe(409);
    expect(mocks.setCurrentGoogleUser).not.toHaveBeenCalled();
  });
});
