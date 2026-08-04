import { describe, expect, it } from 'vitest';
import { isSchoolFeedFresh, schoolFeedToMustDoItems } from './school-feed-must-do';
import type { SchoolFeed } from '@/types/knowledge-base';

describe('schoolFeedToMustDoItems', () => {
  it('converts action_required rows to mustDo', () => {
    const feed: SchoolFeed = {
      updatedAt: new Date().toISOString(),
      gmail: {
        roundups: [],
        actionRequired: [{
          messageId: 'm1',
          from: 'Genazzano',
          subject: 'Permission slip',
          snippet: 'Sign by Friday',
          school: 'Genazzano',
          child: 'Ivy',
          category: 'permission',
          priority: 'action_required',
          gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/m1',
        }],
        fyi: [],
      },
    };

    const items = schoolFeedToMustDoItems(feed);
    expect(items[0]?.source).toBe('school');
    expect(String(items[0]?.action)).toContain('Permission slip');
    expect(items[0]?.gmailUrl).toContain('m1');
  });

  it('detects stale feed', () => {
    const stale: SchoolFeed = {
      updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      gmail: { roundups: [], actionRequired: [], fyi: [] },
    };
    expect(isSchoolFeedFresh(stale)).toBe(false);
    expect(isSchoolFeedFresh({ ...stale, updatedAt: new Date().toISOString() })).toBe(true);
  });
});
