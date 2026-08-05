import { describe, expect, it } from 'vitest';
import {
  classifySchoolCalendarEventType,
  mapSchoolCalendarEvents,
  matchSchoolCalendarChild,
} from './school-calendar-classify';
import type { SchoolProfile } from './school-config';

const profiles: SchoolProfile[] = [
  { child: 'Sebastian', school: 'Xavier College', senderDomains: ['xavier.vic.edu.au'] },
  { child: 'Ivy', school: 'Genazzano FCJ College', senderDomains: ['genazzano.vic.edu.au'] },
];

describe('classifySchoolCalendarEventType', () => {
  it('classifies PE as sport', () => {
    expect(classifySchoolCalendarEventType('Sebastian – PE')).toBe('sport');
  });

  it('classifies library', () => {
    expect(classifySchoolCalendarEventType('Ivy Library')).toBe('library');
  });

  it('classifies excursions', () => {
    expect(classifySchoolCalendarEventType('Sebastian – Zoo excursion')).toBe('excursion');
  });
});

describe('matchSchoolCalendarChild', () => {
  it('matches by child name in title', () => {
    expect(matchSchoolCalendarChild('Sebastian – PE', profiles)?.child).toBe('Sebastian');
  });

  it('matches Ivy', () => {
    expect(matchSchoolCalendarChild('Ivy – Library', profiles)?.child).toBe('Ivy');
  });

  it('matches Seb nickname', () => {
    expect(matchSchoolCalendarChild('Seb – violin', profiles)?.child).toBe('Sebastian');
  });

  it('matches Xavier school shorthand', () => {
    expect(matchSchoolCalendarChild('Xavier – PE', profiles)?.child).toBe('Sebastian');
  });
});

describe('mapSchoolCalendarEvents', () => {
  it('filters non-school events', () => {
    const rows = mapSchoolCalendarEvents([
      { title: 'Team standup', date: '2026-08-06', time: '09:00' },
      { title: 'Sebastian – PE', date: '2026-08-06', time: '10:00' },
    ], profiles);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.child).toBe('Sebastian');
    expect(rows[0]?.eventType).toBe('sport');
  });

  it('dedupes the same event from multiple calendar connections', () => {
    const url = 'https://www.google.com/calendar/event?eid=abc';
    const rows = mapSchoolCalendarEvents([
      { title: 'Ivy: Library 📚', date: '2026-08-06', time: '21:00', calendarUrl: url },
      { title: 'Ivy: Library 📚', date: '2026-08-06', time: '21:00', calendarUrl: url },
    ], profiles);
    expect(rows).toHaveLength(1);
  });
});
