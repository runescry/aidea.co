import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SchoolFeed } from '@/types/knowledge-base';

const mocks = vi.hoisted(() => ({
  readAllKB: vi.fn(),
  writeKB: vi.fn(),
  listSiteNewsItems: vi.fn(),
  listDriveDocuments: vi.fn(),
}));

vi.mock('@/lib/harness/knowledge-base', () => ({
  readAllKB: mocks.readAllKB,
  writeKB: mocks.writeKB,
}));
vi.mock('@/lib/nango/sharepoint', () => ({
  listSiteNewsItems: mocks.listSiteNewsItems,
  listDriveDocuments: mocks.listDriveDocuments,
}));

import { syncSchoolSharePoint } from './school-sharepoint-sync';

const CALENDAR: SchoolFeed['calendar'] = {
  updatedAt: '2026-08-05T00:00:00.000Z',
  weekStart: '2026-08-05',
  weekEnd: '2026-08-11',
  events: [
    { title: 'Ivy library', date: '2026-08-06', time: '09:00', child: 'Ivy', school: 'Genazzano', eventType: 'library' },
  ],
};

const GMAIL: SchoolFeed['gmail'] = {
  roundups: [{ school: 'Genazzano', child: 'Ivy', emailCount: 1, needsYou: [], fyi: [], messageIds: [] }],
  actionRequired: [],
  fyi: [],
};

function kbWithFeed(feed: Partial<SchoolFeed>) {
  return {
    family: {
      children: [{
        name: 'Ivy',
        school: 'Genazzano',
        microsoftSiteId: 'site-1',
        microsoftNewsListId: 'list-1',
        microsoftDocsPath: 'Shared Documents/Timetables',
      }],
      schoolFeed: { updatedAt: '2026-08-05T00:00:00.000Z', gmail: GMAIL, ...feed },
    },
  };
}

describe('syncSchoolSharePoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeKB.mockResolvedValue(undefined);
    mocks.listSiteNewsItems.mockResolvedValue([
      { title: 'Sports carnival', publishedAt: '2026-08-01', url: 'https://school/news/1' },
    ]);
    mocks.listDriveDocuments.mockResolvedValue([
      { name: 'Timetable.pdf', url: 'https://school/doc.pdf', child: 'Ivy' },
    ]);
  });

  it('preserves the calendar section it does not own', async () => {
    mocks.readAllKB.mockResolvedValue(kbWithFeed({ calendar: CALENDAR }));

    const result = await syncSchoolSharePoint();

    expect(result).toMatchObject({ ok: true, newsCount: 1, documentCount: 1 });
    const [, written] = mocks.writeKB.mock.calls[0] as [string, SchoolFeed];
    expect(written.calendar).toEqual(CALENDAR);
    expect(written.gmail).toEqual(GMAIL);
    expect(written.sharepoint?.news).toHaveLength(1);
    expect(written.sharepoint?.documents).toHaveLength(1);
  });

  it('omits the calendar key entirely when there was none', async () => {
    mocks.readAllKB.mockResolvedValue(kbWithFeed({}));

    await syncSchoolSharePoint();

    const [, written] = mocks.writeKB.mock.calls[0] as [string, SchoolFeed];
    expect('calendar' in written).toBe(false);
  });

  it('skips the sync when no child has a SharePoint mapping', async () => {
    mocks.readAllKB.mockResolvedValue({
      family: { children: [{ name: 'Ivy', school: 'Genazzano' }] },
    });

    const result = await syncSchoolSharePoint();

    expect(result).toMatchObject({ ok: true, newsCount: 0, documentCount: 0 });
    expect(mocks.writeKB).not.toHaveBeenCalled();
  });

  it('reports the error and writes nothing when Graph fails', async () => {
    mocks.readAllKB.mockResolvedValue(kbWithFeed({ calendar: CALENDAR }));
    mocks.listSiteNewsItems.mockRejectedValue(new Error('Graph 403'));

    const result = await syncSchoolSharePoint();

    expect(result).toMatchObject({ ok: false, error: 'Graph 403' });
    expect(mocks.writeKB).not.toHaveBeenCalled();
  });
});
