import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./connections', () => ({
  resolveMicrosoftConnections: vi.fn(async () => [{
    connectionId: 'ms-conn',
    integrationId: 'microsoft-school',
    email: 'parent@school.edu.au',
  }]),
}));

// One shared spy across getNango() calls, so tests can assert on the endpoint requested.
const graphGet = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  getNango: vi.fn(() => ({ get: graphGet })),
  microsoftIntegrationId: () => 'microsoft-school',
}));

vi.mock('@/lib/documents/extract-text', () => ({
  extractTextFromBuffer: vi.fn(async () => ({ text: 'Monday PE', truncated: false })),
}));

import { listSiteNewsItems, listDriveDocuments, listSiteLists, searchSharePointSites } from './sharepoint';

describe('sharepoint client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    graphGet.mockImplementation(async ({ endpoint }: { endpoint: string }) => {
      if (endpoint.includes('/content')) {
        return { data: new ArrayBuffer(8) };
      }
      // `/lists?` = list discovery; `/lists/<id>/items` = news rows. Order matters.
      if (endpoint.includes('/lists?')) {
        return {
          data: {
            value: [
              { id: 'list-news', displayName: 'School News', webUrl: 'https://school.sharepoint.com/news', list: { template: 'genericList' } },
              { id: 'list-hidden', displayName: 'Form Templates', list: { template: 'documentLibrary', hidden: true } },
              { id: 'list-docs', displayName: 'Documents', list: { template: 'documentLibrary' } },
            ],
          },
        };
      }
      if (endpoint.includes('sites?search=')) {
        return {
          data: {
            value: [
              { id: 'site-1', displayName: 'Genazzano Parents', webUrl: 'https://school.sharepoint.com/sites/parents' },
              { id: '', displayName: 'Broken site without id' },
            ],
          },
        };
      }
      if (endpoint.includes('/lists/')) {
        return {
          data: {
            value: [{
              webUrl: 'https://school.sharepoint.com/news/1',
              fields: { Title: 'Sports carnival', Created: '2026-08-01' },
            }],
          },
        };
      }
      if (endpoint.includes('/children')) {
        return {
          data: {
            value: [{
              id: 'doc1',
              name: 'Timetable.pdf',
              webUrl: 'https://school.sharepoint.com/doc/timetable.pdf',
              file: { mimeType: 'application/pdf' },
            }],
          },
        };
      }
      return { data: { value: [] } };
    });
  });

  it('lists news items from a SharePoint list', async () => {
    const news = await listSiteNewsItems({ siteId: 'site-1', listId: 'list-1' });
    expect(news[0]?.title).toBe('Sports carnival');
  });

  it('lists drive documents', async () => {
    const docs = await listDriveDocuments({
      siteId: 'site-1',
      folderPath: 'Shared Documents/Timetables',
      child: 'Ivy',
    });
    expect(docs[0]?.name).toBe('Timetable.pdf');
    expect(docs[0]?.child).toBe('Ivy');
  });

  it('searches sites and drops entries Graph returned without an id', async () => {
    const sites = await searchSharePointSites('genazzano');
    expect(sites).toEqual([
      { id: 'site-1', name: 'Genazzano Parents', webUrl: 'https://school.sharepoint.com/sites/parents' },
    ]);
  });

  it('falls back to the wildcard term when the query is blank', async () => {
    await searchSharePointSites('   ');
    expect(graphGet.mock.calls[0]?.[0]?.endpoint).toContain(`search=${encodeURIComponent('*')}`);
  });

  it('lists a site’s lists for news-list discovery, filtering hidden system lists', async () => {
    const lists = await listSiteLists('site-1');
    expect(lists.map(l => l.id)).toEqual(['list-news', 'list-docs']);
    expect(lists[0]).toMatchObject({ name: 'School News', template: 'genericList' });
  });
});
