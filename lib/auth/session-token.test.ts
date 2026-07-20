import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken, stableGoogleUserId, verifySessionToken } from './session-token';

describe('signed app sessions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('round-trips a signed session and rejects tampering', async () => {
    const token = await createSessionToken({
      userId: 'google:account-id',
      mode: 'google',
      verified: true,
      nangoUserId: 'google:temporary-id',
    }, 1_000);

    await expect(verifySessionToken(token, 2_000)).resolves.toMatchObject({
      userId: 'google:account-id',
      mode: 'google',
      verified: true,
      nangoUserId: 'google:temporary-id',
    });
    await expect(verifySessionToken(`${token.slice(0, -1)}x`, 2_000)).resolves.toBeNull();
  });

  it('rejects expired sessions', async () => {
    const token = await createSessionToken({ userId: 'demo:test', mode: 'demo', verified: true }, 1_000);
    await expect(verifySessionToken(token, 1_000 + 366 * 24 * 60 * 60 * 1_000)).resolves.toBeNull();
  });

  it('derives a stable opaque tenant id from a normalized Google email', async () => {
    const first = await stableGoogleUserId(' Person@Example.com ');
    const second = await stableGoogleUserId('person@example.com');
    expect(first).toBe(second);
    expect(first).toMatch(/^google:[a-f0-9]{48}$/);
    expect(first).not.toContain('person');
  });

  it('keeps tenant ids stable when the session signing secret rotates', async () => {
    vi.stubEnv('AIDEA_TENANT_DERIVATION_SECRET', 'permanent-tenant-secret');
    vi.stubEnv('AIDEA_SESSION_SECRET', 'old-session-secret');
    const beforeRotation = await stableGoogleUserId('person@example.com');

    vi.stubEnv('AIDEA_SESSION_SECRET', 'new-session-secret');
    const afterRotation = await stableGoogleUserId('person@example.com');

    expect(afterRotation).toBe(beforeRotation);
  });

  it('requires a dedicated tenant derivation secret in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AIDEA_TENANT_DERIVATION_SECRET', '');

    await expect(stableGoogleUserId('person@example.com')).rejects.toThrow(
      'AIDEA_TENANT_DERIVATION_SECRET is required in production',
    );
  });
});
