import { describe, expect, it } from 'vitest';
import { buildFamilyWeekView, formatFullDate } from './family-week';
import type { SchoolFeed, SchoolFeedEmailRow } from '@/types/knowledge-base';

describe('formatFullDate', () => {
  it('formats a YYYY-MM-DD date as a full weekday + date string', () => {
    expect(formatFullDate('2026-08-10')).toMatch(/^Monday,? 10 August$/);
  });

  it('returns an empty string for an unparseable date', () => {
    expect(formatFullDate('')).toBe('');
    expect(formatFullDate('not-a-date')).toBe('');
  });
});

function emailRow(overrides: Partial<SchoolFeedEmailRow> = {}): SchoolFeedEmailRow {
  return {
    messageId: 'x1',
    from: 'Xavier College <office@xavier.vic.edu.au>',
    subject: 'Pack sports kit',
    snippet: 'Sports day Friday',
    school: 'Xavier College',
    child: 'Sebastian',
    category: 'sport',
    priority: 'action_required',
    gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/x1',
    ...overrides,
  };
}

function feedWith(overrides: Partial<SchoolFeed>): SchoolFeed {
  return {
    updatedAt: '2026-08-10T00:00:00.000Z',
    gmail: { roundups: [], actionRequired: [], fyi: [] },
    ...overrides,
  };
}

describe('buildFamilyWeekView', () => {
  it('returns the empty view when there is no feed', () => {
    expect(buildFamilyWeekView(null, '2026-08-10')).toEqual({
      hasFamilyData: false,
      children: [],
      today: [],
      week: [],
      needsDoing: [],
      goodToKnow: [],
    });
  });

  it('returns the empty view when the feed has no roundups or events', () => {
    const view = buildFamilyWeekView(feedWith({}), '2026-08-10');
    expect(view.hasFamilyData).toBe(false);
  });

  it('derives children from roundups and calendar events, in order of first appearance', () => {
    const view = buildFamilyWeekView(
      feedWith({
        gmail: {
          roundups: [
            { school: 'Genazzano', child: 'Ivy', emailCount: 1, needsYou: [], fyi: [], messageIds: [] },
            { school: 'Xavier College', child: 'Sebastian', emailCount: 1, needsYou: [], fyi: [], messageIds: [] },
          ],
          actionRequired: [],
          fyi: [],
        },
      }),
      '2026-08-10',
    );
    expect(view.children).toEqual([
      { key: 'ivy', name: 'Ivy', colorIndex: 0 },
      { key: 'sebastian', name: 'Sebastian', colorIndex: 1 },
    ]);
  });

  it('splits needs-doing (action_required) from good-to-know (fyi), decoding entities and carrying deadlines', () => {
    const view = buildFamilyWeekView(
      feedWith({
        gmail: {
          roundups: [
            {
              school: 'Xavier College',
              child: 'Sebastian',
              emailCount: 2,
              needsYou: [emailRow({ subject: 'Pay swimming carnival note', snippet: '$12', deadline: 'Friday' })],
              fyi: [emailRow({ messageId: 'x2', subject: 'Term 3 canteen menu &amp; hours', snippet: '' })],
              messageIds: ['x1', 'x2'],
            },
          ],
          actionRequired: [],
          fyi: [],
        },
      }),
      '2026-08-10',
    );
    expect(view.needsDoing).toEqual([{
      id: 'x1',
      title: 'Pay swimming carnival note',
      detail: 'Due Friday — $12',
      childKey: 'sebastian',
      gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/x1',
    }]);
    expect(view.goodToKnow).toEqual([{ id: 'x2', title: 'Term 3 canteen menu & hours', childKey: 'sebastian' }]);
  });

  it('builds today items via the shared school-today-digest phrasing', () => {
    const view = buildFamilyWeekView(
      feedWith({
        calendar: {
          updatedAt: '2026-08-10T00:00:00.000Z',
          weekStart: '2026-08-10',
          weekEnd: '2026-08-16',
          events: [
            { title: 'Sebastian - sport uniform', date: '2026-08-10', time: '09:00', child: 'Sebastian', school: 'Xavier College', eventType: 'sport' },
          ],
        },
      }),
      '2026-08-10',
    );
    expect(view.today).toEqual([{ id: 'today-0', text: 'Seb needs his sports kit', childKey: 'sebastian' }]);
  });

  it('buckets calendar events into week days, deduped, sorted, with today flagged', () => {
    const view = buildFamilyWeekView(
      feedWith({
        calendar: {
          updatedAt: '2026-08-10T00:00:00.000Z',
          weekStart: '2026-08-10',
          weekEnd: '2026-08-16',
          events: [
            { title: 'Ivy library', date: '2026-08-11', time: '09:00', child: 'Ivy', school: 'Genazzano', eventType: 'library' },
            { title: 'Sebastian PE', date: '2026-08-10', time: '09:00', child: 'Sebastian', school: 'Xavier College', eventType: 'sport' },
            { title: 'Sebastian PE', date: '2026-08-10', time: '09:00', child: 'Sebastian', school: 'Xavier College', eventType: 'sport' },
          ],
        },
      }),
      '2026-08-10',
    );
    expect(view.week).toHaveLength(2);
    expect(view.week[0]).toMatchObject({ date: '2026-08-10', label: 'Today', isToday: true, childKeys: ['sebastian'] });
    expect(view.week[0]?.events).toHaveLength(1);
    expect(view.week[1]).toMatchObject({ date: '2026-08-11', isToday: false, childKeys: ['ivy'] });
  });
});
