import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserExecutionContext } from '@/lib/auth/user-context';

const mocks = vi.hoisted(() => ({
  hasApiKey: vi.fn(),
  listMonitorTargets: vi.fn(),
  runWithUserContext: vi.fn(),
}));

vi.mock('@/lib/ai/provider', () => ({ hasApiKey: mocks.hasApiKey }));
vi.mock('@/lib/auth/accounts', () => ({ listMonitorTargets: mocks.listMonitorTargets }));
vi.mock('@/lib/auth/user-context', () => ({ runWithUserContext: mocks.runWithUserContext }));
vi.mock('@/lib/nango/client', () => ({ nangoConfigured: () => false }));
vi.mock('@/lib/nango/connections', () => ({
  listGmailConnectionsLite: vi.fn(),
  hasNangoConnections: vi.fn(),
}));
vi.mock('@/lib/harness/bootstrap', () => ({ bootstrapEntity: vi.fn() }));
vi.mock('@/lib/storage', () => ({ writeLatestBrief: vi.fn() }));
vi.mock('@/lib/harness/queue', () => ({ collapsePendingQueueDuplicates: vi.fn() }));
vi.mock('@/lib/contacts/sync-signals', () => ({ recordRelationshipMonitorSignals: vi.fn() }));

import { GET } from './route';

describe('GET /api/monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasApiKey.mockReturnValue(true);
    mocks.listMonitorTargets.mockResolvedValue([
      { userId: 'google:one', nangoUserId: 'google:owner-one' },
      { userId: 'google:two', nangoUserId: 'google:owner-two' },
    ]);
    mocks.runWithUserContext.mockImplementation(
      async (_target: UserExecutionContext, run: () => Promise<unknown>) => run(),
    );
  });

  it('runs the monitor once for every registered target', async () => {
    const res = await GET(new Request('http://localhost/api/monitor?name=daily') as import('next/server').NextRequest);
    const body = await res.json() as { ok: boolean; processed: number; skipped: number; failed: number };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, processed: 0, skipped: 2, failed: 0 });
    expect(mocks.runWithUserContext).toHaveBeenCalledTimes(2);
    expect(mocks.runWithUserContext).toHaveBeenNthCalledWith(
      1,
      { userId: 'google:one', nangoUserId: 'google:owner-one' },
      expect.any(Function),
    );
  });

  it('rejects unknown monitor names before enumerating accounts', async () => {
    const res = await GET(new Request('http://localhost/api/monitor?name=bogus') as import('next/server').NextRequest);
    expect(res.status).toBe(400);
    expect(mocks.listMonitorTargets).not.toHaveBeenCalled();
  });
});

