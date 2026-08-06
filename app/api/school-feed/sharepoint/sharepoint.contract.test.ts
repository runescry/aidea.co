import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  searchSharePointSites: vi.fn(),
  listSiteLists: vi.fn(),
  syncSchoolSharePoint: vi.fn(),
  nangoConfigured: vi.fn(),
  resolveEndUserId: vi.fn(),
  isDemoUserId: vi.fn(),
}));

vi.mock('@/lib/nango/sharepoint', () => ({
  searchSharePointSites: mocks.searchSharePointSites,
  listSiteLists: mocks.listSiteLists,
}));
vi.mock('@/lib/harness/school-sharepoint-sync', () => ({
  syncSchoolSharePoint: mocks.syncSchoolSharePoint,
}));
vi.mock('@/lib/nango/client', () => ({
  nangoConfigured: mocks.nangoConfigured,
  resolveEndUserId: mocks.resolveEndUserId,
}));
vi.mock('@/lib/auth/session', () => ({ isDemoUserId: mocks.isDemoUserId }));

import { GET, POST } from './route';

const req = (qs: string) => new NextRequest(`https://aidea.test/api/school-feed/sharepoint${qs}`);

describe('/api/school-feed/sharepoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nangoConfigured.mockReturnValue(true);
    mocks.resolveEndUserId.mockResolvedValue('google:abc');
    mocks.isDemoUserId.mockReturnValue(false);
    mocks.searchSharePointSites.mockResolvedValue([{ id: 'site-1', name: 'Parents' }]);
    mocks.listSiteLists.mockResolvedValue([{ id: 'list-1', name: 'News' }]);
    mocks.syncSchoolSharePoint.mockResolvedValue({ ok: true, newsCount: 2, documentCount: 1 });
  });

  it('searches sites by query', async () => {
    const res = await GET(req('?sites=parents'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ sites: [{ id: 'site-1', name: 'Parents' }] });
    expect(mocks.searchSharePointSites).toHaveBeenCalledWith('parents');
  });

  it('returns a site’s lists when siteId is given, without searching sites', async () => {
    const res = await GET(req('?siteId=site-1'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ lists: [{ id: 'list-1', name: 'News' }] });
    expect(mocks.searchSharePointSites).not.toHaveBeenCalled();
  });

  it('surfaces Graph failures as 502 rather than throwing', async () => {
    mocks.searchSharePointSites.mockRejectedValue(new Error('Graph 403 Forbidden'));
    const res = await GET(req('?sites=x'));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'Graph 403 Forbidden' });
  });

  it('returns 503 when Nango is not configured', async () => {
    mocks.nangoConfigured.mockReturnValue(false);
    expect((await GET(req('?sites=x'))).status).toBe(503);
    expect((await POST()).status).toBe(503);
  });

  it('returns empty discovery for demo sessions without calling Graph', async () => {
    mocks.isDemoUserId.mockReturnValue(true);
    const res = await GET(req('?sites=x'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ sites: [], lists: [] });
    expect(mocks.searchSharePointSites).not.toHaveBeenCalled();
  });

  it('runs a manual sync and reports counts', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, newsCount: 2, documentCount: 1 });
  });

  it('returns 502 when the sync itself fails', async () => {
    mocks.syncSchoolSharePoint.mockResolvedValue({ ok: false, newsCount: 0, documentCount: 0, error: 'Graph down' });
    const res = await POST();
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'Graph down' });
  });
});
