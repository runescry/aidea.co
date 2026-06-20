import type { KnowledgeBase, JobApplication, PersonalBuild, CurrentProjects } from '@/types/knowledge-base';
import type { EntityState } from './types';
import type { TaskItem } from './tasks';

export interface ProactiveHygiene {
  dismissed: string[];
  snoozed: Record<string, string>;
}

export function readProactiveHygiene(profile: Record<string, unknown>): ProactiveHygiene {
  const dismissed = Array.isArray(profile.proactiveDismissed)
    ? profile.proactiveDismissed.filter((id): id is string => typeof id === 'string')
    : [];
  const snoozedRaw = profile.proactiveSnoozed;
  const snoozed: Record<string, string> = {};
  if (snoozedRaw && typeof snoozedRaw === 'object' && !Array.isArray(snoozedRaw)) {
    for (const [key, value] of Object.entries(snoozedRaw as Record<string, unknown>)) {
      if (typeof value === 'string') snoozed[key] = value;
    }
  }
  return { dismissed, snoozed };
}

export function applyProactiveHygiene(
  tasks: TaskItem[],
  hygiene: ProactiveHygiene,
  now = new Date(),
): TaskItem[] {
  const dismissed = new Set(hygiene.dismissed);
  return tasks.filter(task => {
    if (task.source !== 'proactive') return true;
    if (dismissed.has(task.id)) return false;
    const until = hygiene.snoozed[task.id];
    if (!until) return true;
    const untilDate = new Date(until);
    return Number.isNaN(untilDate.getTime()) || untilDate <= now;
  });
}

export function dismissProactiveTask(hygiene: ProactiveHygiene, taskId: string): ProactiveHygiene {
  if (hygiene.dismissed.includes(taskId)) return hygiene;
  return { ...hygiene, dismissed: [...hygiene.dismissed, taskId] };
}

export function snoozeProactiveTask(
  hygiene: ProactiveHygiene,
  taskId: string,
  until: Date,
): ProactiveHygiene {
  return {
    ...hygiene,
    snoozed: { ...hygiene.snoozed, [taskId]: until.toISOString() },
  };
}

export function hygieneToProfileUpdates(hygiene: ProactiveHygiene): Record<string, unknown> {
  return {
    proactiveDismissed: hygiene.dismissed,
    proactiveSnoozed: hygiene.snoozed,
  };
}

export function addSnoozeDays(from: Date, days: number): Date {
  const until = new Date(from);
  until.setDate(until.getDate() + days);
  return until;
}

interface RelationshipMonitorOutput {
  checkedAt?: string;
  coolingRelationships?: Array<{
    name: string;
    email?: string;
    type?: string;
    weeksSince?: number;
    draftQueued?: boolean;
  }>;
}

const STALE_STATUS = /declined|rejected|closed|withdrawn|offer received/i;
const MAX_PROACTIVE = 5;

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function structuredProjects(projects?: CurrentProjects): {
  jobApplications: JobApplication[];
  personalBuilds: PersonalBuild[];
} {
  if (!projects || Array.isArray(projects)) {
    return { jobApplications: [], personalBuilds: [] };
  }
  return {
    jobApplications: projects.jobApplications ?? [],
    personalBuilds: projects.personalBuilds ?? [],
  };
}

function staleProjectTasks(projects?: CurrentProjects): TaskItem[] {
  const { jobApplications, personalBuilds } = structuredProjects(projects);
  const tasks: TaskItem[] = [];

  for (const app of jobApplications) {
    if (!app.company?.trim() || !app.nextAction?.trim()) continue;
    if (STALE_STATUS.test(app.status ?? '')) continue;
    tasks.push({
      id: `proactive-job-${slug(app.company)}`,
      source: 'proactive',
      status: 'suggestion',
      title: `${app.company}: ${app.nextAction}`,
      subtitle: `Job application · ${app.status ?? 'In progress'}`,
      createdAt: new Date().toISOString(),
    });
  }

  for (const build of personalBuilds) {
    if (!build.name?.trim() || !build.nextAction?.trim()) continue;
    if (STALE_STATUS.test(build.status ?? '')) continue;
    tasks.push({
      id: `proactive-build-${slug(build.name)}`,
      source: 'proactive',
      status: 'suggestion',
      title: `${build.name}: ${build.nextAction}`,
      subtitle: `Personal project · ${build.status ?? 'Active'}`,
      createdAt: new Date().toISOString(),
    });
  }

  return tasks;
}

function relationshipNudges(entities: EntityState[]): TaskItem[] {
  let latest: { checkedAt: string; data: RelationshipMonitorOutput } | null = null;

  for (const entity of entities) {
    const monitor = entity.data.relationship_monitor as RelationshipMonitorOutput | undefined;
    if (!monitor?.checkedAt) continue;
    if (!latest || monitor.checkedAt > latest.checkedAt) {
      latest = { checkedAt: monitor.checkedAt, data: monitor };
    }
  }

  if (!latest?.data.coolingRelationships) return [];

  return latest.data.coolingRelationships
    .filter(rel => rel.name && !rel.draftQueued)
    .map(rel => ({
      id: `proactive-rel-${slug(rel.email ?? rel.name)}`,
      source: 'proactive' as const,
      status: 'suggestion' as const,
      title: `Reconnect with ${rel.name}`,
      subtitle: rel.weeksSince
        ? `Relationship · ${rel.weeksSince} week${rel.weeksSince === 1 ? '' : 's'} since contact`
        : 'Relationship · cooling',
      createdAt: latest!.checkedAt,
    }));
}

export function buildProactiveTasks(input: {
  kb: KnowledgeBase;
  entities: EntityState[];
}): TaskItem[] {
  const tasks = [
    ...relationshipNudges(input.entities),
    ...staleProjectTasks(input.kb.work?.currentProjects),
  ];

  const seen = new Set<string>();
  const unique: TaskItem[] = [];
  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    unique.push(task);
    if (unique.length >= MAX_PROACTIVE) break;
  }
  return unique;
}

export type UserAutonomyPreference = NonNullable<KnowledgeBase['preferences']>['defaultAutonomyLevel'];

export function autonomyLabel(level?: UserAutonomyPreference): string {
  switch (level) {
    case 'supervised':
      return 'Supervised';
    case 'autonomous':
      return 'Autonomous';
    default:
      return 'Semi-autonomous';
  }
}

export function autonomyHint(level?: UserAutonomyPreference): string {
  switch (level) {
    case 'supervised':
      return 'You approve every action';
    case 'autonomous':
      return 'Agents act within guardrails';
    default:
      return 'Drafts queue for your approval';
  }
}

export function queueActionAutonomyNote(
  level: UserAutonomyPreference | undefined,
  actionType: string,
): string | null {
  if (actionType === 'kb_update') {
    if (level === 'autonomous') return 'Profile updates may apply automatically when approved.';
    if (level === 'supervised') return 'Profile updates require your approval.';
    return 'Profile updates queue here for approval.';
  }
  if (level === 'autonomous') return 'High-trust mode — review carefully before approving sends.';
  if (level === 'supervised') return 'Supervised mode — nothing sends without you.';
  return null;
}
