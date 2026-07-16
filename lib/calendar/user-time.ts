import type { KnowledgeBase } from '@/types/knowledge-base';

/** Profile identity.timezone → DEFAULT_USER_TIMEZONE env → UTC. */
export function resolveUserTimezone(kb?: Pick<KnowledgeBase, 'identity'> | null): string {
  const profileTz = kb?.identity?.timezone?.trim();
  if (profileTz) return profileTz;
  const envTz = process.env.DEFAULT_USER_TIMEZONE?.trim();
  if (envTz) return envTz;
  return 'UTC';
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
