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
  queueActionId?: string;
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

function childFromContext(context: unknown): string | undefined {
  if (typeof context !== 'string' || !context.includes(' · ')) return undefined;
  const child = context.split(' · ').pop()?.trim();
  return child || undefined;
}

/** YYYY-MM-DD → Date anchored at UTC noon, to dodge DST/offset boundary bugs. Null if unparseable. */
function parseYmdAtNoon(dateYmd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd);
  if (!match) return null;
  const [, y, m, d] = match;
  const anchor = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12));
  return Number.isNaN(anchor.getTime()) ? null : anchor;
}

function weekdayLabel(dateYmd: string): string {
  const anchor = parseYmdAtNoon(dateYmd);
  return anchor ? anchor.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }) : '';
}

/** "Monday, 10 August" for a family-view greeting header. Empty string if unparseable. */
export function formatFullDate(dateYmd: string): string {
  const anchor = parseYmdAtNoon(dateYmd);
  return anchor
    ? anchor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    : '';
}

/** Match any known child's first name as a whole word, case-insensitive. */
function matchChildInText(text: string, children: FamilyChild[]): string | undefined {
  const lower = text.toLowerCase();
  for (const child of children) {
    const firstName = child.name.split(/\s+/)[0]?.toLowerCase();
    if (firstName && new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) {
      return child.key;
    }
  }
  return undefined;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value.filter(v => v && typeof v === 'object') as Record<string, unknown>[]) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
}

interface WeekEventLike {
  date?: unknown;
  title?: unknown;
  notes?: unknown;
}

function summarizeDay(
  rawEvents: WeekEventLike[],
  extraText: string[],
  children: FamilyChild[],
): { childKeys: string[]; events: FamilyWeekEvent[] } {
  const keys = new Set<string>();
  const events: FamilyWeekEvent[] = [];
  for (const event of rawEvents) {
    const title = typeof event.title === 'string' ? event.title.trim() : '';
    if (!title) continue;
    const text = `${title} ${event.notes ?? ''}`;
    const childKey = matchChildInText(text, children);
    if (childKey) keys.add(childKey);
    events.push({ title, childKey });
  }
  for (const text of extraText) {
    const match = matchChildInText(text, children);
    if (match) keys.add(match);
  }
  return { childKeys: Array.from(keys), events };
}

/**
 * Shapes an assembled morning brief (lib/harness/daily-kickstart.ts) into the
 * family-facing week view. Pure and deterministic — no agent calls, no I/O.
 */
export function buildFamilyWeekView(brief: Record<string, unknown> | null | undefined): FamilyWeekView {
  if (!brief) return EMPTY_VIEW;

  const mustDo = asArray(brief.mustDo);
  const schoolItems = mustDo.filter(item => item.source === 'school');
  if (schoolItems.length === 0) return EMPTY_VIEW;

  const children: FamilyChild[] = [];
  const seen = new Set<string>();
  for (const item of schoolItems) {
    const name = childFromContext(item.context);
    if (!name) continue;
    const key = childKeyFromName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    children.push({ key, name, colorIndex: children.length % CHILD_COLOR_COUNT });
  }

  const needsDoing: FamilyNeedItem[] = schoolItems
    .filter(item => String(item.urgency ?? '').toUpperCase() === 'HIGH')
    .map((item, i) => {
      const name = childFromContext(item.context);
      return {
        id: String(item.messageId ?? item.queueActionId ?? `need-${i}`),
        title: String(item.action ?? 'School task'),
        detail: typeof item.detail === 'string' ? item.detail : undefined,
        childKey: name ? childKeyFromName(name) : undefined,
        gmailUrl: typeof item.gmailUrl === 'string' ? item.gmailUrl : undefined,
        queueActionId: typeof item.queueActionId === 'string' ? item.queueActionId : undefined,
      };
    });

  const goodToKnow: FamilyGoodToKnowItem[] = schoolItems
    .filter(item => String(item.urgency ?? '').toUpperCase() !== 'HIGH')
    .map((item, i) => {
      const name = childFromContext(item.context);
      return {
        id: String(item.messageId ?? `fyi-${i}`),
        title: String(item.action ?? 'School update'),
        childKey: name ? childKeyFromName(name) : undefined,
      };
    });

  const logistics = asStringArray(brief.logistics);
  const today: FamilyTodayItem[] = logistics.map((text, i) => ({
    id: `today-${i}`,
    text,
    childKey: matchChildInText(text, children),
  }));

  const week: FamilyWeekDay[] = [];
  const todayDate = typeof brief.date === 'string' ? brief.date : '';
  if (todayDate) {
    const todaySchedule = asArray(brief.schedule) as WeekEventLike[];
    const { childKeys, events } = summarizeDay(todaySchedule, logistics, children);
    week.push({ date: todayDate, label: 'Today', isToday: true, childKeys, events });
  }

  const tomorrowEvents = asArray(brief.tomorrowPreview) as WeekEventLike[];
  const tomorrowDate = typeof tomorrowEvents[0]?.date === 'string' ? (tomorrowEvents[0]!.date as string) : '';
  if (tomorrowEvents.length > 0) {
    const { childKeys, events } = summarizeDay(tomorrowEvents, [], children);
    week.push({
      date: tomorrowDate,
      label: tomorrowDate ? weekdayLabel(tomorrowDate) || 'Tomorrow' : 'Tomorrow',
      isToday: false,
      childKeys,
      events,
    });
  }

  const weekAhead = asArray(brief.weekAhead) as WeekEventLike[];
  const byDate = new Map<string, WeekEventLike[]>();
  for (const event of weekAhead) {
    const date = typeof event.date === 'string' ? event.date : '';
    if (!date || date === todayDate || date === tomorrowDate) continue;
    const bucket = byDate.get(date) ?? [];
    bucket.push(event);
    byDate.set(date, bucket);
  }
  for (const [date, rawEvents] of Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const { childKeys, events } = summarizeDay(rawEvents, [], children);
    week.push({ date, label: weekdayLabel(date) || date, isToday: false, childKeys, events });
  }

  return { hasFamilyData: true, children, today, week, needsDoing, goodToKnow };
}
