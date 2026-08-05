import type { SchoolFeed, SchoolFeedEmailRow } from '@/types/knowledge-base';
import type { SchoolCalendarEventRow } from './school-calendar-classify';
import { dedupeSchoolCalendarEvents } from './school-calendar-classify';
import { buildSchoolTodayItems, schoolEventToPrepLine } from './school-today-digest';
import { decodeBriefText } from './morning-brief-must-do';

const CHILD_COLOR_COUNT = 4;

export interface FamilyChild {
  key: string;
  name: string;
  colorIndex: number;
}

export interface FamilyTodayItem {
  id: string;
  text: string;
  childKey?: string;
}

export interface FamilyWeekEvent {
  title: string;
  childKey?: string;
}

export interface FamilyWeekDay {
  date: string;
  label: string;
  isToday: boolean;
  childKeys: string[];
  events: FamilyWeekEvent[];
}

export interface FamilyNeedItem {
  id: string;
  title: string;
  detail?: string;
  childKey?: string;
  gmailUrl?: string;
}

export interface FamilyGoodToKnowItem {
  id: string;
  title: string;
  childKey?: string;
}

export interface FamilyWeekView {
  hasFamilyData: boolean;
  children: FamilyChild[];
  today: FamilyTodayItem[];
  week: FamilyWeekDay[];
  needsDoing: FamilyNeedItem[];
  goodToKnow: FamilyGoodToKnowItem[];
}

const EMPTY_VIEW: FamilyWeekView = {
  hasFamilyData: false,
  children: [],
  today: [],
  week: [],
  needsDoing: [],
  goodToKnow: [],
};

function childKeyFromName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseYmdAtNoon(dateYmd: string): Date | null {
  const anchor = new Date(`${dateYmd}T12:00:00.000Z`);
  return Number.isNaN(anchor.getTime()) ? null : anchor;
}

/** Weekday label for a YYYY-MM-DD date, anchored at UTC noon to dodge DST/offset boundary bugs. */
function weekdayLabel(dateYmd: string): string {
  const anchor = parseYmdAtNoon(dateYmd);
  return anchor ? anchor.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }) : '';
}

/** "Monday, 10 August" for the family-view greeting header. Empty string if unparseable. */
export function formatFullDate(dateYmd: string): string {
  const anchor = parseYmdAtNoon(dateYmd);
  return anchor
    ? anchor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    : '';
}

function needItemFromRow(row: SchoolFeedEmailRow, children: FamilyChild[]): FamilyNeedItem {
  const detailParts = [row.deadline ? `Due ${row.deadline}` : '', decodeBriefText(row.snippet)].filter(Boolean);
  return {
    id: row.messageId,
    title: decodeBriefText(row.subject),
    detail: detailParts.length > 0 ? detailParts.join(' — ') : undefined,
    childKey: children.find(c => c.name === row.child)?.key,
    gmailUrl: row.gmailUrl,
  };
}

/**
 * Shapes a school feed (lib/harness/school-feed-sync.ts, stored at
 * profile.family.schoolFeed) into the family-facing week view. Pure and
 * deterministic — reuses the same digest logic SchoolTodayPanel already
 * relies on, so "today" phrasing stays consistent everywhere it appears.
 */
export function buildFamilyWeekView(feed: SchoolFeed | null | undefined, todayYmd: string): FamilyWeekView {
  const roundups = feed?.gmail?.roundups ?? [];
  const rawEvents = feed?.calendar?.events ?? [];
  // actionRequired/fyi carry standalone school emails that didn't bundle into a roundup
  // (SchoolCard renders these as siblings of roundups — same source, same priority).
  const standaloneAction = feed?.gmail?.actionRequired ?? [];
  const standaloneFyi = feed?.gmail?.fyi ?? [];
  if (roundups.length === 0 && rawEvents.length === 0 && standaloneAction.length === 0 && standaloneFyi.length === 0) {
    return EMPTY_VIEW;
  }

  const children: FamilyChild[] = [];
  const seen = new Set<string>();
  const addChild = (name: string) => {
    const key = childKeyFromName(name);
    if (seen.has(key)) return;
    seen.add(key);
    children.push({ key, name, colorIndex: children.length % CHILD_COLOR_COUNT });
  };
  for (const roundup of roundups) addChild(roundup.child);
  for (const row of standaloneAction) addChild(row.child);
  for (const row of standaloneFyi) addChild(row.child);
  for (const event of rawEvents) addChild(event.child);

  const goodToKnowRow = (row: SchoolFeedEmailRow) => ({
    id: row.messageId,
    title: decodeBriefText(row.subject),
    childKey: children.find(c => c.name === row.child)?.key,
  });

  const needsDoing = [...roundups.flatMap(r => r.needsYou), ...standaloneAction]
    .map(row => needItemFromRow(row, children));
  const goodToKnow = [...roundups.flatMap(r => r.fyi), ...standaloneFyi].map(goodToKnowRow);

  const events = dedupeSchoolCalendarEvents(rawEvents);

  const today: FamilyTodayItem[] = buildSchoolTodayItems(events, todayYmd).map((item, i) => ({
    id: `today-${i}`,
    text: item.line,
    childKey: children.find(c => c.name === item.child)?.key,
  }));

  const byDate = new Map<string, SchoolCalendarEventRow[]>();
  for (const event of events) {
    const bucket = byDate.get(event.date) ?? [];
    bucket.push(event);
    byDate.set(event.date, bucket);
  }

  const week: FamilyWeekDay[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEvents]) => ({
      date,
      label: date === todayYmd ? 'Today' : weekdayLabel(date) || date,
      isToday: date === todayYmd,
      childKeys: Array.from(new Set(dayEvents.map(e => children.find(c => c.name === e.child)?.key).filter((k): k is string => Boolean(k)))),
      events: dayEvents.map(e => ({
        title: schoolEventToPrepLine(e),
        childKey: children.find(c => c.name === e.child)?.key,
      })),
    }));

  return { hasFamilyData: true, children, today, week, needsDoing, goodToKnow };
}
