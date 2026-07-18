import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../../../middleware';
import { AIDEA_SESSION_COOKIE, createSessionToken } from '@/lib/auth/session-token';

describe('production API session middleware', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects protected API requests without a signed session', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AIDEA_SESSION_SECRET', 'contract-test-secret');
    const res = await middleware(new NextRequest('https://aidea.test/api/kb'));
    expect(res.status).toBe(401);
  });

  it('accepts protected API requests with a signed session', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AIDEA_SESSION_SECRET', 'contract-test-secret');
    const token = await createSessionToken({ userId: 'demo:test', mode: 'demo', verified: true });
    const req = new NextRequest('https://aidea.test/api/kb', {
      headers: { cookie: `${AIDEA_SESSION_COOKIE}=${token}` },
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('limits pending Google sessions to connection completion APIs', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AIDEA_SESSION_SECRET', 'contract-test-secret');
    const token = await createSessionToken({
      userId: 'google:temporary',
      mode: 'google',
      verified: false,
      nangoUserId: 'google:temporary',
    });
    const headers = { cookie: `${AIDEA_SESSION_COOKIE}=${token}` };

    await expect(middleware(new NextRequest('https://aidea.test/api/kb', { headers })))
      .resolves.toMatchObject({ status: 401 });
    await expect(middleware(new NextRequest('https://aidea.test/api/nango/session', { headers })))
      .resolves.toMatchObject({ status: 200 });
  });

  it('keeps session creation and cron endpoints public', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(middleware(new NextRequest('https://aidea.test/api/auth/session')))
      .resolves.toMatchObject({ status: 200 });
    await expect(middleware(new NextRequest('https://aidea.test/api/monitor')))
      .resolves.toMatchObject({ status: 200 });
  });
});
