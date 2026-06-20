/** YYYY-MM-DD in UTC (matches entity bootstrap currentDate). */
export function toDateYmd(d: Date = new Date()): string {
  return d.toISOString().split('T')[0];
}

export function addCalendarDays(dateYmd: string, days: number): string {
  const d = new Date(`${dateYmd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Inclusive calendar-day window for Google Calendar timeMin/timeMax (timeMax exclusive). */
export function calendarDayRange(dateYmd: string, spanDays: number): { timeMin: string; timeMax: string } {
  const days = Math.max(1, spanDays);
  return {
    timeMin: `${dateYmd}T00:00:00.000Z`,
    timeMax: `${addCalendarDays(dateYmd, days)}T00:00:00.000Z`,
  };
}

/** Extract YYYY-MM-DD from Google event start (dateTime or all-day date). */
export function eventDateYmd(start: string): string {
  if (!start) return '';
  return start.slice(0, 10);
}

export function formatEventTime(start: string): string {
  if (!start) return '';
  if (start.length <= 10) return 'All day';
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start.slice(11, 16);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

export function isSameCalendarDay(start: string, dateYmd: string): boolean {
  return eventDateYmd(start) === dateYmd;
}
