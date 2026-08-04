import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/nango/gmail', () => ({
  readGmailMessages: vi.fn(),
}));

vi.mock('@/lib/harness/knowledge-base', () => ({
  readAllKB: vi.fn(),
  writeKB: vi.fn(),
}));

import { readGmailMessages } from '@/lib/nango/gmail';
import { readAllKB, writeKB } from '@/lib/harness/knowledge-base';
import { syncSchoolInbox } from './school-inbox-sync';

describe('syncSchoolInbox', () => {
  beforeEach(() => {
    vi.mocked(readAllKB).mockResolvedValue({ family: { children: [] } });
    vi.mocked(writeKB).mockResolvedValue(undefined);
  });

  it('writes empty feed when no school emails', async () => {
    vi.mocked(readGmailMessages).mockResolvedValue({
      emails: [],
      query: 'from:(genazzano OR xavier) newer_than:14d',
      connections: ['conn-1'],
    });

    const result = await syncSchoolInbox();
    expect(result.ok).toBe(true);
    expect(result.emailCount).toBe(0);
    expect(writeKB).toHaveBeenCalledWith('family.schoolFeed', expect.objectContaining({
      gmail: { roundups: [], actionRequired: [], fyi: [] },
    }));
  });

  it('classifies and stores school emails', async () => {
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
    expect(writeKB).toHaveBeenCalledWith(
      'family.schoolFeed',
      expect.objectContaining({
        gmail: expect.objectContaining({
          actionRequired: expect.arrayContaining([
            expect.objectContaining({ school: 'Genazzano', child: 'Ivy' }),
          ]),
        }),
      }),
    );
  });
});
