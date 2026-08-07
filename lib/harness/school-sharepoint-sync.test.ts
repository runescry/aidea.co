import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SchoolFeed } from '@/types/knowledge-base';

const mocks = vi.hoisted(() => ({
  readAllKB: vi.fn(),
  writeManyKB: vi.fn(),
  readProfile: vi.fn(),
  listSiteNewsItems: vi.fn(),
  listDriveDocuments: vi.fn(),
}));

vi.mock('@/lib/harness/knowledge-base', () => ({
  readAllKB: mocks.readAllKB,
  writeManyKB: mocks.writeManyKB,
}));
vi.mock('@/lib/storage', () => ({ readProfile: mocks.readProfile }));
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

const CHILD = {
  name: 'Ivy',
  school: 'Genazzano',
  microsoftSiteId: 'site-1',
  microsoftNewsListId: 'list-1',
  microsoftDocsPath: 'Shared Documents/Timetables',
};

function kb(feed?: Partial<SchoolFeed>) {
  return {
    family: {
      children: [CHILD],
      ...(feed ? { schoolFeed: { updatedAt: '2026-08-05T00:00:00.000Z', gmail: GMAIL, ...feed } } : {}),
    },
  };
}

describe('syncSchoolSharePoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeManyKB.mockResolvedValue(undefined);
    mocks.readAllKB.mockResolvedValue(kb({ calendar: CALENDAR }));
    mocks.readProfile.mockResolvedValue(kb({ calendar: CALENDAR }));
    mocks.listSiteNewsItems.mockResolvedValue([
      { title: 'Sports carnival', publishedAt: '2026-08-01', url: 'https://school/news/1' },
    ]);
    mocks.listDriveDocuments.mockResolvedValue([
      { name: 'Timetable.pdf', url: 'https://school/doc.pdf', child: 'Ivy' },
    ]);
  });

  it('writes only the sharepoint section it owns, never the whole feed', async () => {
    const result = await syncSchoolSharePoint();

    expect(result).toMatchObject({ ok: true, newsCount: 1, documentCount: 1 });
    const [updates] = mocks.writeManyKB.mock.calls[0] as [Record<string, unknown>];
    // Scoped paths only — no 'family.schoolFeed' wholesale overwrite, which is what let a
    // stale snapshot clobber a concurrent gmail/calendar write.
    expect(Object.keys(updates).sort()).toEqual([
      'family.schoolFeed.sharepoint',
      'family.schoolFeed.updatedAt',
    ]);
    expect(updates['family.schoolFeed.sharepoint']).toEqual({
      news: [{ title: 'Sports carnival', publishedAt: '2026-08-01', url: 'https://school/news/1' }],
      documents: [{ name: 'Timetable.pdf', url: 'https://school/doc.pdf', child: 'Ivy' }],
    });
  });

  it('does not resurrect a stale calendar when a sibling job writes during the Graph calls', async () => {
    // school-inbox (*/15) and school-sync (0 * * * *) both fire at :00. Simulate the calendar
    // landing after this job's initial read: the pre-call snapshot has no calendar at all.
    mocks.readAllKB.mockResolvedValue(kb({}));
    mocks.readProfile.mockResolvedValue(kb({ calendar: CALENDAR }));

    await syncSchoolSharePoint();

    const [updates] = mocks.writeManyKB.mock.calls[0] as [Record<string, unknown>];
    // Nothing here touches calendar, so the freshly-written sibling data survives untouched.
    expect(Object.keys(updates)).not.toContain('family.schoolFeed.calendar');
    expect(Object.keys(updates)).not.toContain('family.schoolFeed');
  });

  it('seeds an empty gmail section when no feed exists yet, so Home does not throw', async () => {
    mocks.readAllKB.mockResolvedValue(kb());
    mocks.readProfile.mockResolvedValue(kb());

    await syncSchoolSharePoint();

    const [updates] = mocks.writeManyKB.mock.calls[0] as [Record<string, unknown>];
    expect(updates['family.schoolFeed.gmail']).toEqual({ roundups: [], actionRequired: [], fyi: [] });
  });

  it('leaves an existing gmail section alone', async () => {
    await syncSchoolSharePoint();

    const [updates] = mocks.writeManyKB.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(updates)).not.toContain('family.schoolFeed.gmail');
  });

  it('skips the sync when no child has a SharePoint mapping', async () => {
    mocks.readAllKB.mockResolvedValue({ family: { children: [{ name: 'Ivy', school: 'Genazzano' }] } });

    const result = await syncSchoolSharePoint();

    expect(result).toMatchObject({ ok: true, newsCount: 0, documentCount: 0 });
    expect(mocks.writeManyKB).not.toHaveBeenCalled();
  });

  it('reports the error and writes nothing when Graph fails', async () => {
    mocks.listSiteNewsItems.mockRejectedValue(new Error('Graph 403'));

    const result = await syncSchoolSharePoint();

    expect(result).toMatchObject({ ok: false, error: 'Graph 403' });
    expect(mocks.writeManyKB).not.toHaveBeenCalled();
  });
});
