import { describe, expect, it } from 'vitest';
import { buildSchoolPrepItems, buildSchoolTodayItems, schoolEventToTodayLine } from './school-today-digest';
import type { SchoolCalendarEventRow } from './school-calendar-classify';

function event(partial: Partial<SchoolCalendarEventRow> & Pick<SchoolCalendarEventRow, 'title' | 'child'>): SchoolCalendarEventRow {
  return {
    date: '2026-08-12',
    time: '08:00',
    school: 'School',
    eventType: 'other',
    ...partial,
  };
}

describe('schoolEventToTodayLine', () => {
  it('formats PE uniform', () => {
    expect(schoolEventToTodayLine(event({
      title: 'Ivy: PE Uniform 👟',
      child: 'Ivy',
      eventType: 'sport',
    }))).toBe('Ivy needs her PE uniform');
  });

  it('formats violin for Sebastian as Seb', () => {
    expect(schoolEventToTodayLine(event({
      title: 'Sebastian – violin',
      child: 'Sebastian',
    }))).toBe('Seb needs his violin');
  });

  it('formats strings as violin', () => {
    expect(schoolEventToTodayLine(event({
      title: 'Seb: Strings 🎻',
      child: 'Sebastian',
    }))).toBe('Seb needs his violin');
  });

  it('formats library', () => {
    expect(schoolEventToTodayLine(event({
      title: 'Ivy: Library 📚',
      child: 'Ivy',
      eventType: 'library',
    }))).toBe('Ivy has library today');
  });
});

describe('buildSchoolTodayItems', () => {
  it('filters to today only and dedupes', () => {
    const items = buildSchoolTodayItems([
      event({ title: 'Ivy: PE Uniform 👟', child: 'Ivy', date: '2026-08-12', eventType: 'sport' }),
      event({ title: 'Sebastian – violin', child: 'Sebastian', date: '2026-08-12' }),
      event({ title: 'Ivy: Library 📚', child: 'Ivy', date: '2026-08-13', eventType: 'library' }),
    ], '2026-08-12');
    expect(items).toHaveLength(2);
    expect(items.map(i => i.line)).toContain('Ivy needs her PE uniform');
    expect(items.map(i => i.line)).toContain('Seb needs his violin');
  });
});

describe('buildSchoolPrepItems', () => {
  it('includes upcoming friendly lines with dates', () => {
    const items = buildSchoolPrepItems([
      event({ title: 'Ivy: PE Uniform 👟', child: 'Ivy', date: '2026-08-12', eventType: 'sport' }),
      event({ title: 'Ivy: Library 📚', child: 'Ivy', date: '2026-08-06', eventType: 'library' }),
    ], '2026-08-05');
    expect(items.map(i => i.line)).toContain('Ivy needs her PE uniform (Wed, 12 Aug)');
    expect(items.map(i => i.line)).toContain('Ivy has library tomorrow');
  });
});
