import { describe, expect, it } from 'vitest';
import { getCurrentNangoUserId, getCurrentUserId } from './session';
import { runWithUserContext } from './user-context';

describe('runWithUserContext', () => {
  it('scopes storage and Nango identity during background work', async () => {
    await runWithUserContext(
      { userId: 'google:stable', nangoUserId: 'google:temporary-owner' },
      async () => {
        await expect(getCurrentUserId()).resolves.toBe('google:stable');
        await expect(getCurrentNangoUserId()).resolves.toBe('google:temporary-owner');
      },
    );
  });
});

