import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SchoolFeed } from '@/types/knowledge-base';

const mocks = vi.hoisted(() => ({
  readAllKB: vi.fn(),
  writeManyKB: vi.fn(),
  readProfile: vi.fn(),
  readCalendarEvents: vi.fn(),
}));

vi.mock('@/lib/harness/knowledge-base', () => ({
  readAllKB: mocks.readAllKB,
  writeManyKB: mocks.writeManyKB,
}));
vi.mock('@/lib/storage', () => ({ readProfile: mocks.readProfile }));
vi.mock('@/lib/nango/calendar', () => ({ readCalendarEvents: mocks.readCalendarEvents }));

import { syncSchoolCalendar } from './school-calendar-sync';

const GMAIL: SchoolFeed['gmail'] = {
  roundups: [{ school: 'Genazzano', child: 'Ivy', emailCount: 1, needsYou: [], fyi: [], messageIds: [] }],
  actionRequired: [],
  fyi: [],
};

const SHAREPOINT: SchoolFeed['sharepoint'] = { news: [], documents: [] };

const CHILD = { name: 'Ivy', school: 'Genazzano FCJ College', senderDomains: ['genazzano.vic.edu.au'] };

function kb(feed?: Partial<SchoolFeed>) {
  return {
    family: {
      children: [CHILD],
      ...(feed ? { schoolFeed: { updatedAt: '2026-08-05T00:00:00.000Z', gmail: GMAIL, ...feed } } : {}),
    },
  };
}

describe('syncSchoolCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mocks.writeManyKB).mockResolvedValue(undefined);
    vi.mocked(mocks.readAllKB).mockResolvedValue(kb({ gmail: GMAIL, sharepoint: SHAREPOINT }));
    vi.mocked(mocks.readProfile).mockResolvedValue(kb({ gmail: GMAIL, sharepoint: SHAREPOINT }));
    vi.mocked(mocks.readCalendarEvents).mockResolvedValue({
      events: [
        { title: 'Ivy library', date: '2026-08-06', start: '2026-08-06T09:00:00.000Z', location: '', htmlLink: '' },
      ],
      connections: ['conn-1'],
      readErrors: [],
    });
  });

  it('writes only the calendar section it owns, never the whole feed', async () => {
    const result = await syncSchoolCalendar();

    expect(result.ok).toBe(true);
    expect(result.eventCount).toBe(1);
    const [updates] = mocks.writeManyKB.mock.calls[0] as [Record<string, unknown>];
    // Scoped paths only — no 'family.schoolFeed' wholesale overwrite, which is what let a
    // stale snapshot clobber a concurrent gmail/sharepoint write.
    expect(Object.keys(updates).sort()).toEqual([
      'family.schoolFeed.calendar',
      'family.schoolFeed.updatedAt',
    ]);
  });

  it('does not resurrect stale gmail/sharepoint when a sibling job writes during the sync', async () => {
    // school-inbox (*/15) and school-sync (0 * * * *) both fire at :00. Simulate gmail/sharepoint
    // landing after this job's initial read: the pre-call snapshot has neither section.
    mocks.readAllKB.mockResolvedValue(kb({}));
    mocks.readProfile.mockResolvedValue(kb({ gmail: GMAIL, sharepoint: SHAREPOINT }));

    await syncSchoolCalendar();

    const [updates] = mocks.writeManyKB.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(updates)).not.toContain('family.schoolFeed.gmail');
    expect(Object.keys(updates)).not.toContain('family.schoolFeed.sharepoint');
    expect(Object.keys(updates)).not.toContain('family.schoolFeed');
  });

  it('seeds an empty gmail section when no feed exists yet, so Home does not throw', async () => {
    mocks.readAllKB.mockResolvedValue(kb());
    mocks.readProfile.mockResolvedValue(kb());

    await syncSchoolCalendar();

    const [updates] = mocks.writeManyKB.mock.calls[0] as [Record<string, unknown>];
    expect(updates['family.schoolFeed.gmail']).toEqual({ roundups: [], actionRequired: [], fyi: [] });
  });

  it('leaves an existing gmail section alone', async () => {
    await syncSchoolCalendar();

    const [updates] = mocks.writeManyKB.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(updates)).not.toContain('family.schoolFeed.gmail');
  });

  it('reports the error and writes nothing when the calendar read fails', async () => {
    mocks.readCalendarEvents.mockRejectedValue(new Error('Calendar 403'));

    const result = await syncSchoolCalendar();

    expect(result).toMatchObject({ ok: false, error: 'Calendar 403' });
    expect(mocks.writeManyKB).not.toHaveBeenCalled();
  });
});
