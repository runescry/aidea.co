import type { QueueAuditEntry } from './queue-audit';
import type { EntityState } from './types';
import type { TaskItem } from './tasks';
import { ACTION_TYPE_LABELS } from './action-labels';

export type TimelineDomain = 'email' | 'calendar' | 'kb' | 'health' | 'session' | 'brief';

export interface TimelineEntry {
  id: string;
  domain: TimelineDomain;
  title: string;
  subtitle?: string;
  at: string;
  agentRole?: string;
  status?: string;
}

const AUDIT_DOMAIN: Partial<Record<QueueAuditEntry['type'], TimelineDomain>> = {
  email_reply: 'email',
  email_send: 'email',
  calendar_event: 'calendar',
  kb_update: 'kb',
};

const BOOTSTRAP_DATA_KEYS = new Set([
  'currentDate', 'currentTime', 'dayOfWeek', 'command', 'conversationHistory',
]);

function yesterdayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999));
  return { start, end };
}

function isWithinRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t <= end.getTime();
}

function isSameCalendarDay(iso: string, day: Date): boolean {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getUTCFullYear() === day.getUTCFullYear()
    && parsed.getUTCMonth() === day.getUTCMonth()
    && parsed.getUTCDate() === day.getUTCDate();
}

function entityHasArtifact(data: Record<string, unknown>): boolean {
  return Object.keys(data).some(key => !BOOTSTRAP_DATA_KEYS.has(key));
}

function auditStatusLabel(status: QueueAuditEntry['status']): string {
  if (status === 'approved' || status === 'executed') return 'Completed';
  if (status === 'saved') return 'Saved to drafts';
  if (status === 'rejected') return 'Rejected';
  return 'Failed';
}

export function buildYesterdayTimeline(input: {
  audit?: QueueAuditEntry[];
  entities?: EntityState[];
  brief?: Record<string, unknown> | null;
  now?: Date;
}): TimelineEntry[] {
  const now = input.now ?? new Date();
  const { start, end } = yesterdayRange(now);
  const entries: TimelineEntry[] = [];

  for (const row of input.audit ?? []) {
    if (!isWithinRange(row.resolvedAt, start, end)) continue;
    const domain = AUDIT_DOMAIN[row.type] ?? 'session';
    const typeLabel = ACTION_TYPE_LABELS[row.type] ?? row.type;
    entries.push({
      id: `audit-${row.id}`,
      domain,
      title: row.summary,
      subtitle: `${typeLabel} · ${auditStatusLabel(row.status)}`,
      at: row.resolvedAt,
      agentRole: row.agentRole,
      status: row.status,
    });
  }

  for (const entity of input.entities ?? []) {
    if (!isWithinRange(entity.updatedAt, start, end)) continue;
    if (!entityHasArtifact(entity.data)) continue;
    entries.push({
      id: `entity-${entity.entityId}`,
      domain: 'session',
      title: entity.entityName,
      subtitle: `${entity.entityType} · ${entity.status}`,
      at: entity.updatedAt,
      status: entity.status,
    });
  }

  const brief = input.brief;
  if (brief && typeof brief === 'object') {
    const generatedAt =
      typeof brief.generatedAt === 'string' ? brief.generatedAt
        : typeof brief.date === 'string' ? `${brief.date}T06:00:00.000Z`
          : undefined;
    if (generatedAt && isSameCalendarDay(generatedAt, start)) {
      const mustDo = Array.isArray(brief.mustDo) ? brief.mustDo.length : 0;
      entries.push({
        id: 'brief-yesterday',
        domain: 'brief',
        title: 'Morning brief',
        subtitle: mustDo > 0 ? `${mustDo} priorit${mustDo === 1 ? 'y' : 'ies'}` : 'Daily brief',
        at: generatedAt,
      });
    }
  }

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function timelineToTaskItems(entries: TimelineEntry[]): TaskItem[] {
  return entries.map(entry => ({
    id: `timeline-${entry.id}`,
    source: 'timeline',
    status: 'done',
    title: entry.title,
    subtitle: entry.subtitle,
    createdAt: entry.at,
    timeline: entry,
  }));
}
