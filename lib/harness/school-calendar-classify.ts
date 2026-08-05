import type { SchoolProfile } from './school-config';

export type SchoolCalendarEventType = 'sport' | 'library' | 'excursion' | 'other';

export interface SchoolCalendarEventRow {
  title: string;
  date: string;
  time: string;
  child: string;
  school: string;
  eventType: SchoolCalendarEventType;
  location?: string;
  calendarUrl?: string;
}

const SPORT = /\b(pe|sport|sports|swimming|athletics|cross country|basketball|football|soccer|netball)\b/i;
const LIBRARY = /\b(library|borrowing)\b/i;
const EXCURSION = /\b(excursion|camp|incursion|outing|zoo|museum|excursion)\b/i;

export function classifySchoolCalendarEventType(title: string): SchoolCalendarEventType {
  const text = title.trim();
  if (EXCURSION.test(text)) return 'excursion';
  if (LIBRARY.test(text)) return 'library';
  if (SPORT.test(text)) return 'sport';
  return 'other';
}

export function schoolCalendarEventLabel(type: SchoolCalendarEventType): string {
  if (type === 'sport') return 'Sport';
  if (type === 'library') return 'Library';
  if (type === 'excursion') return 'Excursion';
  return 'School';
}

/** Match child by name in title; falls back to school name if exactly one profile matches. */
export function matchSchoolCalendarChild(title: string, profiles: SchoolProfile[]): SchoolProfile | null {
  const lower = title.toLowerCase();

  const aliases: Array<{ child: string; patterns: string[] }> = [
    { child: 'Sebastian', patterns: ['sebastian', 'seb'] },
    { child: 'Ivy', patterns: ['ivy'] },
  ];

  for (const { child, patterns } of aliases) {
    const profile = profiles.find(p => p.child === child);
    if (!profile) continue;
    if (patterns.some(pattern => lower.includes(pattern))) return profile;
  }

  const byChild = profiles.filter(p => p.child && lower.includes(p.child.toLowerCase()));
  if (byChild.length === 1) return byChild[0]!;
  if (byChild.length > 1) {
    return byChild.sort((a, b) => b.child.length - a.child.length)[0]!;
  }

  const bySchool = profiles.filter(p => {
    if (!p.school) return false;
    const school = p.school.toLowerCase();
    const short = school.split(/\s+/)[0] ?? school;
    return lower.includes(school) || (short.length >= 4 && lower.includes(short));
  });
  if (bySchool.length === 1) return bySchool[0]!;
  return null;
}

export function isSchoolCalendarCandidate(title: string, profiles: SchoolProfile[]): boolean {
  return matchSchoolCalendarChild(title, profiles) != null;
}

export interface RawCalendarEvent {
  title: string;
  date: string;
  time: string;
  location?: string;
  calendarUrl?: string;
}

function schoolCalendarEventDedupeKey(row: SchoolCalendarEventRow): string {
  if (row.calendarUrl) return row.calendarUrl;
  return `${row.date}|${row.time}|${row.title}|${row.child}|${row.school}`;
}

export function dedupeSchoolCalendarEvents(events: SchoolCalendarEventRow[]): SchoolCalendarEventRow[] {
  const seen = new Set<string>();
  const unique: SchoolCalendarEventRow[] = [];
  for (const event of events) {
    const key = schoolCalendarEventDedupeKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
  }
  return unique;
}

export function mapSchoolCalendarEvents(
  events: RawCalendarEvent[],
  profiles: SchoolProfile[],
): SchoolCalendarEventRow[] {
  const rows: SchoolCalendarEventRow[] = [];
  for (const event of events) {
    const profile = matchSchoolCalendarChild(event.title, profiles);
    if (!profile) continue;
    rows.push({
      title: event.title.trim(),
      date: event.date,
      time: event.time,
      child: profile.child,
      school: profile.school,
      eventType: classifySchoolCalendarEventType(event.title),
      location: event.location?.trim() || undefined,
      calendarUrl: event.calendarUrl,
    });
  }
  return dedupeSchoolCalendarEvents(rows).sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
  );
}
