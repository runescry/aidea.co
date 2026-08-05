import type { SchoolCalendarEventRow } from './school-calendar-classify';

export interface SchoolTodayItem {
  child: string;
  line: string;
  calendarUrl?: string;
}

const NICKNAME: Record<string, string> = {
  Sebastian: 'Seb',
  Ivy: 'Ivy',
};

const PRONOUN: Record<string, 'his' | 'her'> = {
  Sebastian: 'his',
  Ivy: 'her',
};

function displayName(child: string): string {
  return NICKNAME[child] ?? child.split(/\s+/)[0] ?? child;
}

function possessive(child: string): string {
  return PRONOUN[child] ?? 'their';
}

function stripChildPrefix(title: string, child: string): string {
  const nick = displayName(child);
  let rest = title.trim();
  for (const prefix of [child, nick]) {
    const re = new RegExp(`^${prefix}\\s*[:\\-–—]\\s*`, 'i');
    rest = rest.replace(re, '');
  }
  return rest.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
}

/** Turn a calendar event title into a short parent-facing line. */
export function schoolEventToTodayLine(event: SchoolCalendarEventRow): string {
  const name = displayName(event.child);
  const pos = possessive(event.child);
  const detail = stripChildPrefix(event.title, event.child);
  const lower = detail.toLowerCase();

  if (/\b(hpe|sports uniform|sport uniform)\b/i.test(lower)) {
    return `${name} needs ${pos} sports kit`;
  }
  if (/\b(pe uniform|sports kit|sport uniform|pe kit)\b/i.test(lower) || /\bpe uniform\b/i.test(event.title)) {
    return `${name} needs ${pos} PE uniform`;
  }
  if (/\b(sports kit|sport kit)\b/i.test(lower)) {
    return `${name} needs ${pos} sports kit`;
  }
  if (/\b(strings|violin)\b/i.test(lower)) {
    return `${name} needs ${pos} violin`;
  }
  if (/\bviolin\b/i.test(lower)) {
    return `${name} needs ${pos} violin`;
  }
  if (/\b(instrument|music)\b/i.test(lower) && !/\bconcert\b/i.test(lower)) {
    const instrument = /\bviolin\b/i.test(lower) ? 'violin' : 'instrument';
    return `${name} needs ${pos} ${instrument}`;
  }
  if (event.eventType === 'library' || /\blibrary\b/i.test(lower)) {
    return `${name} has library today`;
  }
  if (event.eventType === 'excursion' || /\b(excursion|camp|incursion)\b/i.test(lower)) {
    const label = detail.length > 0 && detail.length < 60 ? detail : 'school excursion';
    return `${name} has ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  }
  if (/\b(late start|early finish|pupil free)\b/i.test(lower)) {
    return `${name}: ${detail}`;
  }
  if (/\b(concert|assembly|photo)\b/i.test(lower)) {
    return `${name} has ${detail.charAt(0).toLowerCase()}${detail.slice(1)}`;
  }
  if (detail.length > 0 && detail.length <= 48) {
    if (/^(pe|sport)\b/i.test(detail)) {
      return `${name} needs ${pos} sports kit`;
    }
    return `${name}: ${detail}`;
  }
  if (event.eventType === 'sport') {
    return `${name} needs ${pos} sports kit`;
  }

  return `${name} — ${detail || event.title}`;
}

/** Parent-facing line for calendar lists where the date is shown separately. */
export function schoolEventToPrepLine(event: SchoolCalendarEventRow): string {
  return schoolEventToTodayLine(event).replace(/\s+today\b/gi, '');
}

function addCalendarDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatPrepDate(dateYmd: string): string {
  const d = new Date(`${dateYmd}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateYmd;
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

export function buildSchoolTodayItems(
  events: SchoolCalendarEventRow[],
  todayYmd: string,
): SchoolTodayItem[] {
  const todayEvents = events.filter(e => e.date === todayYmd);
  const seen = new Set<string>();
  const items: SchoolTodayItem[] = [];

  for (const event of todayEvents) {
    const line = schoolEventToTodayLine(event);
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      child: event.child,
      line,
      calendarUrl: event.calendarUrl,
    });
  }

  return items.sort((a, b) => a.line.localeCompare(b.line));
}

/** Today first, then the rest of the synced week with friendly prep lines. */
export function buildSchoolPrepItems(
  events: SchoolCalendarEventRow[],
  todayYmd: string,
  weekEnd?: string,
): SchoolTodayItem[] {
  const upcoming = events
    .filter(e => e.date >= todayYmd && (!weekEnd || e.date <= weekEnd))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const seen = new Set<string>();
  const items: SchoolTodayItem[] = [];
  const tomorrowYmd = addCalendarDaysYmd(todayYmd, 1);

  for (const event of upcoming) {
    let line: string;
    if (event.date === todayYmd) {
      line = schoolEventToTodayLine(event);
    } else if (event.date === tomorrowYmd) {
      line = schoolEventToTodayLine(event).replace(/\btoday\b/gi, 'tomorrow');
    } else {
      line = `${schoolEventToPrepLine(event)} (${formatPrepDate(event.date)})`;
    }

    const key = `${event.date}:${line.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      child: event.child,
      line,
      calendarUrl: event.calendarUrl,
    });
  }

  return items;
}
