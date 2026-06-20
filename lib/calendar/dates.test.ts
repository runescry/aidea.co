import { describe, expect, it } from 'vitest';
import { addCalendarDays, calendarDayRange, eventDateYmd, isSameCalendarDay } from './dates';

describe('calendar dates', () => {
  it('calendarDayRange spans calendar days not rolling 48h', () => {
    const { timeMin, timeMax } = calendarDayRange('2026-06-20', 2);
    expect(timeMin).toBe('2026-06-20T00:00:00.000Z');
    expect(timeMax).toBe('2026-06-22T00:00:00.000Z');
  });

  it('addCalendarDays advances by calendar day', () => {
    expect(addCalendarDays('2026-06-20', 1)).toBe('2026-06-21');
  });

  it('isSameCalendarDay matches event start to anchor date', () => {
    expect(isSameCalendarDay('2026-06-23T08:00:00+10:00', '2026-06-23')).toBe(true);
    expect(isSameCalendarDay('2026-06-23T08:00:00+10:00', '2026-06-20')).toBe(false);
  });

  it('eventDateYmd extracts date portion', () => {
    expect(eventDateYmd('2026-06-20')).toBe('2026-06-20');
    expect(eventDateYmd('2026-06-20T08:00:00.000Z')).toBe('2026-06-20');
  });
});
