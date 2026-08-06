import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/nango/gmail', () => ({
  readGmailMessages: vi.fn(),
}));

vi.mock('@/lib/harness/knowledge-base', () => ({
  readAllKB: vi.fn(),
  writeManyKB: vi.fn(),
}));

import { readGmailMessages } from '@/lib/nango/gmail';
import { readAllKB, writeManyKB } from '@/lib/harness/knowledge-base';
import { syncSchoolInbox } from './school-inbox-sync';

import { DEFAULT_SCHOOL_CHILDREN } from './school-config';

describe('syncSchoolInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readAllKB).mockResolvedValue({
      family: { children: DEFAULT_SCHOOL_CHILDREN.map(c => ({ ...c })) },
    });
    vi.mocked(writeManyKB).mockResolvedValue(undefined);
  });

  it('writes only the gmail section when no school emails, never the whole feed', async () => {
    vi.mocked(readGmailMessages).mockResolvedValue({
      emails: [],
      query: 'from:(genazzano OR xavier) newer_than:14d',
      connections: ['conn-1'],
    });

    const result = await syncSchoolInbox();
    expect(result.ok).toBe(true);
    expect(result.emailCount).toBe(0);
    const [updates] = vi.mocked(writeManyKB).mock.calls[0] as [Record<string, unknown>];
    // Scoped paths only — no 'family.schoolFeed' wholesale overwrite, which is what let a
    // stale snapshot clobber a concurrent calendar/sharepoint write.
    expect(Object.keys(updates).sort()).toEqual([
      'family.schoolFeed.gmail',
      'family.schoolFeed.updatedAt',
    ]);
    expect(updates['family.schoolFeed.gmail']).toEqual({ roundups: [], actionRequired: [], fyi: [] });
  });

  it('classifies and stores school emails, writing only the gmail section', async () => {
    vi.mocked(readGmailMessages).mockResolvedValue({
      emails: [
        {
          id: 'g1',
          from: 'Genazzano FCJ College <office@genazzano.vic.edu.au>',
          subject: 'Permission form — swimming',
          snippet: 'Please sign and return consent by Friday',
          date: 'Mon, 4 Aug 2026',
          isUnread: true,
          connectionId: 'conn-1',
        },
      ],
      query: 'from:(@genazzano.vic.edu.au OR genazzano OR xavier) newer_than:14d',
      connections: ['conn-1'],
    });

    const result = await syncSchoolInbox();
    expect(result.ok).toBe(true);
    expect(result.emailCount).toBe(1);
    expect(result.actionRequired).toBeGreaterThan(0);
    const [updates] = vi.mocked(writeManyKB).mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(updates).sort()).toEqual([
      'family.schoolFeed.gmail',
      'family.schoolFeed.updatedAt',
    ]);
    expect(updates['family.schoolFeed.gmail']).toEqual(
      expect.objectContaining({
        actionRequired: expect.arrayContaining([
          expect.objectContaining({ school: 'Genazzano FCJ College', child: 'Ivy' }),
        ]),
      }),
    );
  });

  it('does not touch calendar or sharepoint when a sibling job writes during the sync', async () => {
    // school-inbox (*/15) and school-sync (0 * * * *) collide at :00. Even if the KB already
    // has calendar/sharepoint data from a sibling job, this job must never re-read or rewrite it.
    vi.mocked(readAllKB).mockResolvedValue({
      family: {
        children: DEFAULT_SCHOOL_CHILDREN.map(c => ({ ...c })),
        schoolFeed: {
          updatedAt: '2026-08-05T00:00:00.000Z',
          gmail: { roundups: [], actionRequired: [], fyi: [] },
          calendar: { updatedAt: '2026-08-05T00:00:00.000Z', weekStart: '2026-08-05', weekEnd: '2026-08-11', events: [] },
        },
      },
    });
    vi.mocked(readGmailMessages).mockResolvedValue({
      emails: [],
      query: 'newer_than:14d',
      connections: ['conn-1'],
    });

    await syncSchoolInbox();

    const [updates] = vi.mocked(writeManyKB).mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(updates)).not.toContain('family.schoolFeed.calendar');
    expect(Object.keys(updates)).not.toContain('family.schoolFeed.sharepoint');
    expect(Object.keys(updates)).not.toContain('family.schoolFeed');
  });
});
