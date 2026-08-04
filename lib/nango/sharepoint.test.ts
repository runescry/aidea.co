import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./connections', () => ({
  resolveMicrosoftConnections: vi.fn(async () => [{
    connectionId: 'ms-conn',
    integrationId: 'microsoft-school',
    email: 'parent@school.edu.au',
  }]),
}));

vi.mock('./client', () => ({
  getNango: vi.fn(() => ({
    get: vi.fn(async ({ endpoint }: { endpoint: string }) => {
      if (endpoint.includes('/content')) {
        return { data: new ArrayBuffer(8) };
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
    }),
  })),
  microsoftIntegrationId: () => 'microsoft-school',
}));

vi.mock('@/lib/documents/extract-text', () => ({
  extractTextFromBuffer: vi.fn(async () => ({ text: 'Monday PE', truncated: false })),
}));

import { listSiteNewsItems, listDriveDocuments } from './sharepoint';

describe('sharepoint client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
