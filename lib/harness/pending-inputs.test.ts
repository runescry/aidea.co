import { beforeEach, describe, expect, it, vi } from 'vitest';

let currentUserId = 'google:first';

vi.mock('@/lib/auth/session', () => ({
  getCurrentUserId: vi.fn(async () => currentUserId),
}));

import { awaitHumanInput, hasPendingInput, resolveHumanInput } from './pending-inputs';

describe('pending human input tenancy', () => {
  beforeEach(() => {
    currentUserId = 'google:first';
  });

  it('only lets the owning tenant resolve a request', async () => {
    const answer = awaitHumanInput('request-1', 1_000);
    await vi.waitFor(async () => expect(await hasPendingInput('request-1')).toBe(true));

    currentUserId = 'google:second';
    await expect(resolveHumanInput('request-1', 'wrong tenant')).resolves.toBe(false);

    currentUserId = 'google:first';
    await expect(resolveHumanInput('request-1', 'approved')).resolves.toBe(true);
    await expect(answer).resolves.toBe('approved');
  });
});
