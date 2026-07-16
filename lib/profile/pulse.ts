import type { TaskItem } from '@/lib/harness/tasks';
import type { KnowledgeBase } from '@/types/knowledge-base';

export type ProfilePulseKind = 'focus' | 'change' | 'pending' | 'nudge' | 'sync';

export interface ProfilePulseItem {
  id: string;
  kind: ProfilePulseKind;
  at: string;
  title: string;
  detail?: string;
  source?: string;
  chatPrompt?: string;
}

const PULSE_KIND_ORDER: Record<ProfilePulseKind, number> = {
  pending: 0,
  focus: 1,
  nudge: 2,
  change: 3,
  sync: 4,
};

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

function isRecent(iso: string, now: number): boolean {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && now - t <= RECENT_MS;
}

function briefFocusItem(task: TaskItem): ProfilePulseItem | null {
  const brief = task.brief;
  if (!brief || typeof brief !== 'object') return null;
  const mustDo = Array.isArray(brief.mustDo) ? brief.mustDo : [];
  const first = mustDo[0];
  const action =
    first &&
    typeof first === 'object' &&
    first !== null &&
    typeof (first as { action?: unknown }).action === 'string'
      ? (first as { action: string }).action
      : undefined;

  return {
    id: 'pulse-brief',
    kind: 'focus',
    at: task.createdAt,
    title: action ?? task.title,
    detail: task.subtitle,
    source: 'daily-orchestrator',
    chatPrompt: 'Walk me through today\'s priorities from my morning brief.',
  };
}

function kbQueueItem(task: TaskItem, now: number): ProfilePulseItem | null {
  if (task.type !== 'kb_update' || task.source !== 'queue') return null;
  const agent = task.action?.agentRole ?? task.subtitle?.split(' · ').pop();

  if (task.status === 'needs_you') {
    return {
      id: task.id,
      kind: 'pending',
      at: task.createdAt,
      title: task.title,
      detail: 'Awaiting your approval',
      source: agent,
      chatPrompt: `Review this profile update before I approve it: ${task.title}`,
    };
  }

  if (task.status !== 'done' || !isRecent(task.createdAt, now)) return null;
  return {
    id: task.id,
    kind: 'change',
    at: task.createdAt,
    title: task.title,
    detail: 'Applied to profile',
    source: agent,
  };
}

function relationshipNudge(task: TaskItem): ProfilePulseItem | null {
  if (task.source !== 'proactive' || !task.relationship) return null;
  const rel = task.relationship;
  return {
    id: task.id,
    kind: 'nudge',
    at: task.createdAt,
    title: task.title,
    detail: rel.weeksSince
      ? `Last touch ~${rel.weeksSince} week${rel.weeksSince === 1 ? '' : 's'} ago`
      : task.subtitle,
    source: 'relationship-monitor',
    chatPrompt: `Help me reconnect with ${rel.name}.`,
  };
}

function timelineKbItem(task: TaskItem): ProfilePulseItem | null {
  if (task.source !== 'timeline' || task.timeline?.domain !== 'kb') return null;
  return {
    id: task.id,
    kind: 'change',
    at: task.createdAt,
    title: task.title,
    detail: task.subtitle,
    source: task.timeline.agentRole,
  };
}

function healthSyncItem(kb: KnowledgeBase, now: number): ProfilePulseItem | null {
  const syncedAt = kb.health?.sync?.lastSyncedAt;
  if (!syncedAt) return null;
  if (!isRecent(syncedAt, now)) return null;
  const count = kb.health?.sync?.recentActivities?.length ?? 0;
  return {
    id: 'pulse-strava',
    kind: 'sync',
    at: syncedAt,
    title: 'Strava synced',
    detail: count > 0 ? `${count} recent activit${count === 1 ? 'y' : 'ies'}` : 'Health profile updated',
    source: 'strava',
  };
}

function healthTrainingItem(task: TaskItem): ProfilePulseItem | null {
  if (task.source !== 'health') return null;
  return {
    id: task.id,
    kind: 'focus',
    at: task.createdAt,
    title: task.title,
    detail: task.subtitle,
    source: 'health-briefer',
    chatPrompt: 'Help me follow today\'s training plan.',
  };
}

export function buildProfilePulse(input: {
  kb: KnowledgeBase;
  tasks: TaskItem[];
  timeline: TaskItem[];
  now?: number;
  limit?: number;
}): ProfilePulseItem[] {
  const now = input.now ?? Date.now();
  const limit = input.limit ?? 8;
  const items: ProfilePulseItem[] = [];
  const seen = new Set<string>();

  const push = (item: ProfilePulseItem | null) => {
    if (!item || seen.has(item.id)) return;
    const alwaysShow = item.kind === 'focus' || item.kind === 'pending';
    if (!alwaysShow && !isRecent(item.at, now)) return;
    seen.add(item.id);
    items.push(item);
  };

  for (const task of input.tasks) {
    if (task.source === 'brief') push(briefFocusItem(task));
    else if (task.source === 'health') push(healthTrainingItem(task));
    else if (task.source === 'queue') push(kbQueueItem(task, now));
    else if (task.source === 'proactive') push(relationshipNudge(task));
  }

  for (const task of input.timeline) {
    push(timelineKbItem(task));
  }

  push(healthSyncItem(input.kb, now));

  return items
    .sort((a, b) => {
      const kindDiff = PULSE_KIND_ORDER[a.kind] - PULSE_KIND_ORDER[b.kind];
      if (kindDiff !== 0) return kindDiff;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    })
    .slice(0, limit);
}

export function profileLastActivityLabel(pulse: ProfilePulseItem[], now = Date.now()): string | null {
  if (pulse.length === 0) return null;
  const latest = pulse.reduce((max, item) => {
    const t = new Date(item.at).getTime();
    return t > max ? t : max;
  }, 0);
  if (!latest) return null;
  const diffMs = now - latest;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(latest).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
