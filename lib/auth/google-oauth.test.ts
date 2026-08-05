import { describe, expect, it, vi } from 'vitest';
import { verifyGoogleIdToken } from './google-oauth';

describe('verifyGoogleIdToken', () => {
  it('accepts a valid tokeninfo payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'client-id',
        email: 'person@example.com',
        email_verified: true,
        name: 'Person',
        exp: String(Math.floor(Date.now() / 1000) + 3600),
      }),
    }));

    await expect(verifyGoogleIdToken('token', 'client-id')).resolves.toEqual({
      email: 'person@example.com',
      name: 'Person',
    });

    vi.unstubAllGlobals();
  });
});
