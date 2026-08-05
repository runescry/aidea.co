import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  getCurrentNangoUserId: vi.fn(),
  setCurrentGoogleUser: vi.fn(),
  getConnectedGoogleIdentity: vi.fn(),
  claimTenantData: vi.fn(),
  registerGoogleAccount: vi.fn(),
  getRegisteredNangoUserId: vi.fn(),
  mergeProfile: vi.fn(),
  deleteAllConnectionsForEndUser: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getCurrentNangoUserId: mocks.getCurrentNangoUserId,
  setCurrentGoogleUser: mocks.setCurrentGoogleUser,
}));
vi.mock('@/lib/nango/connections', () => ({
  getConnectedGoogleIdentity: mocks.getConnectedGoogleIdentity,
  invalidateNangoConnectionsCache: vi.fn(),
  deleteAllConnectionsForEndUser: mocks.deleteAllConnectionsForEndUser,
}));
vi.mock('@/lib/storage/tenant-copy', () => ({ claimTenantData: mocks.claimTenantData }));
vi.mock('@/lib/auth/accounts', () => ({
  registerGoogleAccount: mocks.registerGoogleAccount,
  getRegisteredNangoUserId: mocks.getRegisteredNangoUserId,
}));
vi.mock('@/lib/storage', () => ({ mergeProfile: mocks.mergeProfile }));

import { POST } from './route';

describe('POST /api/auth/google/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue('google:temporary');
    mocks.getCurrentNangoUserId.mockResolvedValue('google:temporary');
    mocks.getConnectedGoogleIdentity.mockResolvedValue({ email: 'person@example.com' });
    mocks.registerGoogleAccount.mockResolvedValue(undefined);
    mocks.getRegisteredNangoUserId.mockResolvedValue(null);
    mocks.mergeProfile.mockResolvedValue(undefined);
    mocks.deleteAllConnectionsForEndUser.mockResolvedValue(0);
  });

  it('claims temporary data and promotes the signed session to a stable Google tenant', async () => {
    const res = await POST();
    const body = await res.json() as { ok: boolean; userId: string; email: string };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.userId).toMatch(/^google:[a-f0-9]{48}$/);
    expect(body.email).toBe('person@example.com');
    expect(mocks.claimTenantData).toHaveBeenCalledWith('google:temporary', body.userId);
    expect(mocks.setCurrentGoogleUser).toHaveBeenCalledWith(body.userId, 'google:temporary');
    expect(mocks.registerGoogleAccount).toHaveBeenCalledWith(body.userId, 'google:temporary');
    expect(mocks.mergeProfile).toHaveBeenCalledWith({ 'preferences.onboardingComplete': true });
  });

  it('does not create a session when Google identity cannot be resolved', async () => {
    mocks.getConnectedGoogleIdentity.mockRejectedValue(new Error('Google connection did not return an email address'));
    const res = await POST();

    expect(res.status).toBe(409);
    expect(mocks.setCurrentGoogleUser).not.toHaveBeenCalled();
    expect(mocks.registerGoogleAccount).not.toHaveBeenCalled();
  });

  it('completes sign-in even if registering the monitor account fails', async () => {
    mocks.registerGoogleAccount.mockRejectedValue(new Error('db unavailable'));
    const res = await POST();

    expect(res.status).toBe(200);
    expect(mocks.setCurrentGoogleUser).toHaveBeenCalled();
  });
});
