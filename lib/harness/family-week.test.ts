import { describe, expect, it } from 'vitest';
import { buildFamilyWeekView } from './family-week';

function schoolMustDo(overrides: Record<string, unknown> = {}) {
  return {
    priority: 1,
    action: 'Pack sports kit',
    context: 'Xavier College · Sebastian',
    source: 'school',
    urgency: 'HIGH',
    messageId: 'x1',
    gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/x1',
    ...overrides,
  };
}

describe('buildFamilyWeekView', () => {
  it('returns the empty view when there is no brief', () => {
    expect(buildFamilyWeekView(null)).toEqual({
      hasFamilyData: false,
      children: [],
      today: [],
      week: [],
      needsDoing: [],
      goodToKnow: [],
    });
  });

  it('returns the empty view when mustDo has no school-sourced items', () => {
    const view = buildFamilyWeekView({
      mustDo: [{ action: 'Reply to Sarah', context: 'sarah@acme.com', source: 'email', urgency: 'HIGH' }],
    });
    expect(view.hasFamilyData).toBe(false);
  });

  it('derives children in order of first appearance, cycling color slots', () => {
    const view = buildFamilyWeekView({
      mustDo: [
        schoolMustDo({ context: 'Xavier College · Sebastian', messageId: 'x1' }),
        schoolMustDo({ context: 'Genazzano · Ivy', messageId: 'g1' }),
        schoolMustDo({ context: 'Xavier College · Sebastian', messageId: 'x2' }),
      ],
    });
    expect(view.children).toEqual([
      { key: 'sebastian', name: 'Sebastian', colorIndex: 0 },
      { key: 'ivy', name: 'Ivy', colorIndex: 1 },
    ]);
  });

  it('splits needs-doing (HIGH) from good-to-know (everything else)', () => {
    const view = buildFamilyWeekView({
      mustDo: [
        schoolMustDo({ urgency: 'HIGH', action: 'Buy ticket', messageId: 'x1' }),
        schoolMustDo({ urgency: 'NORMAL', action: 'Newsletter', messageId: 'x2' }),
      ],
    });
    expect(view.needsDoing).toHaveLength(1);
    expect(view.needsDoing[0]?.title).toBe('Buy ticket');
    expect(view.needsDoing[0]?.childKey).toBe('sebastian');
    expect(view.goodToKnow).toHaveLength(1);
    expect(view.goodToKnow[0]?.title).toBe('Newsletter');
  });

  it('tags today items to a child when the logistics text names them', () => {
    const view = buildFamilyWeekView({
      mustDo: [schoolMustDo()],
      date: '2026-08-10',
      logistics: ['Sebastian has PE today — pack sports kit', 'Bin night'],
    });
    expect(view.today).toEqual([
      { id: 'today-0', text: 'Sebastian has PE today — pack sports kit', childKey: 'sebastian' },
      { id: 'today-1', text: 'Bin night', childKey: undefined },
    ]);
  });

  it('builds a today entry from schedule + date even with no tomorrow/weekAhead data', () => {
    const view = buildFamilyWeekView({
      mustDo: [schoolMustDo()],
      date: '2026-08-10',
      schedule: [{ time: '09:00', title: 'Sebastian — swimming carnival' }],
    });
    expect(view.week).toEqual([
      {
        date: '2026-08-10',
        label: 'Today',
        isToday: true,
        childKeys: ['sebastian'],
        events: [{ title: 'Sebastian — swimming carnival', childKey: 'sebastian' }],
      },
    ]);
  });

  it('adds a tomorrow entry from tomorrowPreview', () => {
    const view = buildFamilyWeekView({
      mustDo: [schoolMustDo()],
      date: '2026-08-10',
      tomorrowPreview: [{ date: '2026-08-11', title: 'Ivy — library day' }],
    });
    expect(view.week).toHaveLength(2);
    expect(view.week[1]).toMatchObject({ date: '2026-08-11', isToday: false });
  });

  it('buckets optional weekAhead entries by date, sorted, skipping today/tomorrow duplicates', () => {
    const view = buildFamilyWeekView({
      mustDo: [
        schoolMustDo({ context: 'Xavier College · Sebastian', messageId: 'x1' }),
        schoolMustDo({ context: 'Genazzano · Ivy', messageId: 'g1' }),
      ],
      date: '2026-08-10',
      tomorrowPreview: [{ date: '2026-08-11', title: 'Ivy — library day' }],
      weekAhead: [
        { date: '2026-08-13', title: 'Sebastian — violin lesson' },
        { date: '2026-08-10', title: 'duplicate of today, should be skipped' },
        { date: '2026-08-12', title: 'Ivy — swimming carnival note due' },
      ],
    });
    expect(view.week.map(d => d.date)).toEqual(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']);
    expect(view.week[2]).toMatchObject({ label: 'Wed', childKeys: ['ivy'] });
    expect(view.week[3]).toMatchObject({ label: 'Thu', childKeys: ['sebastian'] });
  });

  it('ignores weekAhead entries with no date', () => {
    const view = buildFamilyWeekView({
      mustDo: [schoolMustDo()],
      date: '2026-08-10',
      weekAhead: [{ title: 'no date, should be dropped' }],
    });
    expect(view.week).toHaveLength(1);
  });
});
