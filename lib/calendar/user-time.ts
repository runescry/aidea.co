import type { KnowledgeBase } from '@/types/knowledge-base';
import { addCalendarDays } from './dates';

/** Profile identity.timezone → DEFAULT_USER_TIMEZONE env → Australia/Melbourne. */
export function resolveUserTimezone(kb?: Pick<KnowledgeBase, 'identity'> | null): string {
  const profileTz = kb?.identity?.timezone?.trim();
  if (profileTz) return profileTz;
  const envTz = process.env.DEFAULT_USER_TIMEZONE?.trim();
  if (envTz) return envTz;
  return 'Australia/Melbourne';
}

export function userDateYmd(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function userLocalTime(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

export function userDayOfWeek(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
  }).format(now);
}

export function userDateContext(now: Date, timeZone: string): {
  currentDate: string;
  currentTime: string;
  dayOfWeek: string;
  userTimezone: string;
} {
  return {
    currentDate: userDateYmd(now, timeZone),
    currentTime: userLocalTime(now, timeZone),
    dayOfWeek: userDayOfWeek(now, timeZone),
    userTimezone: timeZone,
  };
}

/** Compare a YYYY-MM-DD anchor or ISO timestamp to the user's local calendar day. */
export function isUserLocalSameDay(
  dateYmdOrIso: string,
  now: Date,
  timeZone: string,
): boolean {
  const today = userDateYmd(now, timeZone);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateYmdOrIso)) {
    return dateYmdOrIso === today;
  }
  const parsed = new Date(dateYmdOrIso);
  if (Number.isNaN(parsed.getTime())) return false;
  return userDateYmd(parsed, timeZone) === today;
}

/** UTC ISO for local midnight at the start of dateYmd in timeZone. */
export function localMidnightUtcIso(dateYmd: string, timeZone: string): string {
  const [year, month, day] = dateYmd.split('-').map(Number);
  let ms = Date.UTC(year, month - 1, day, 0, 0, 0);
  while (userDateYmd(new Date(ms), timeZone) < dateYmd) ms += 3600_000;
  while (userDateYmd(new Date(ms - 3600_000), timeZone) === dateYmd) ms -= 3600_000;
  return new Date(ms).toISOString();
}

/** Inclusive local-day window for Google Calendar API (timeMax exclusive). */
export function calendarDayRangeInTimeZone(
  anchorDateYmd: string,
  spanDays: number,
  timeZone: string,
): { timeMin: string; timeMax: string } {
  const days = Math.max(1, spanDays);
  return {
    timeMin: localMidnightUtcIso(anchorDateYmd, timeZone),
    timeMax: localMidnightUtcIso(addCalendarDays(anchorDateYmd, days), timeZone),
  };
}

/** Map a Google event start to the user's local calendar date. */
export function eventDateYmdInTimeZone(start: string, timeZone: string): string {
  if (!start) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return start;
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start.slice(0, 10);
  return userDateYmd(d, timeZone);
}
