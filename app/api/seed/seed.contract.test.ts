import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthMode = vi.fn();

vi.mock('@/lib/auth/session', () => ({ getCurrentAuthMode: () => mockAuthMode() }));
vi.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/storage', () => ({
  clearActivityHistory: vi.fn(),
  saveQueuedAction: vi.fn(),
  saveEntityState: vi.fn(),
  writeLatestBrief: vi.fn(),
  writeProfile: vi.fn(),
}));
vi.mock('@/lib/harness/tasks-cache', () => ({ invalidateDevTasksCache: vi.fn() }));
vi.mock('@/lib/nango/connections', () => ({ invalidateNangoConnectionsCache: vi.fn() }));

import { POST } from './route';

describe('POST /api/seed', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    mockAuthMode.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it('rejects non-demo production sessions', async () => {
    mockAuthMode.mockResolvedValue('google');
    const response = await POST(new Request('http://localhost/api/seed', {
      method: 'POST',
      body: '{}',
    }) as import('next/server').NextRequest);
    expect(response.status).toBe(403);
  });

  it('allows demo production sessions', async () => {
    mockAuthMode.mockResolvedValue('demo');
    const response = await POST(new Request('http://localhost/api/seed', {
      method: 'POST',
      body: JSON.stringify({ includeProfile: true }),
    }) as import('next/server').NextRequest);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, profileLoaded: true });
  });
});
