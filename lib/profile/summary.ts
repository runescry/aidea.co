import { buildContactGraph, type ContactGraphEntry } from '@/lib/contacts/interaction-graph';
import type { JobApplication, KnowledgeBase } from '@/types/knowledge-base';
import { hasProjects } from '@/types/knowledge-base';

export type ProfileDomain =
  | 'identity'
  | 'work'
  | 'contacts'
  | 'health'
  | 'preferences'
  | 'finance';

export const PROFILE_DOMAINS: Array<{ id: ProfileDomain; label: string; hint: string }> = [
  { id: 'identity', label: 'Identity & goals', hint: 'Who you are' },
  { id: 'work', label: 'Work', hint: 'Role and projects' },
  { id: 'contacts', label: 'People', hint: 'Relationships' },
  { id: 'health', label: 'Health', hint: 'Training and wellness' },
  { id: 'preferences', label: 'Preferences', hint: 'Briefings and tone' },
  { id: 'finance', label: 'Finance', hint: 'Subscriptions and budget' },
];

function domainFilled(kb: KnowledgeBase, domain: ProfileDomain): boolean {
  switch (domain) {
    case 'identity':
      return Boolean(
        kb.identity?.name?.trim()
        || kb.goals?.currentChapter?.trim()
        || kb.goals?.lifePriorities?.length
        || kb.family?.partner?.name?.trim(),
      );
    case 'work':
      return Boolean(kb.work?.role?.trim() || hasProjects(kb.work?.currentProjects));
    case 'contacts':
      return buildContactGraph(kb).length > 0;
    case 'health':
      return Boolean(
        kb.health?.sync?.recentActivities?.length
        || kb.health?.currentGoals?.length
        || Object.values(kb.health?.workoutSchedule ?? {}).some(v => v?.trim()),
      );
    case 'preferences':
      return Boolean(
        kb.preferences?.newsTopics?.length
        || kb.preferences?.briefingTime?.trim()
        || kb.preferences?.defaultAutonomyLevel,
      );
    case 'finance':
      return Boolean(
        kb.finance?.monthlyBudgetNotes?.trim()
        || kb.finance?.subscriptions?.some(s => s.name?.trim()),
      );
    default:
      return false;
  }
}

export function profileCompletenessPercent(kb: KnowledgeBase): number {
  const filled = PROFILE_DOMAINS.filter(d => domainFilled(kb, d.id)).length;
  return Math.round((filled / PROFILE_DOMAINS.length) * 100);
}

export function profileDisplayName(kb: KnowledgeBase): string {
  return kb.identity?.preferredName?.trim()
    || kb.identity?.name?.trim()
    || 'Your profile';
}

export function profileSubtitle(kb: KnowledgeBase): string {
  const parts = [
    kb.identity?.location?.trim(),
    kb.identity?.role?.trim() || kb.work?.role?.trim(),
  ].filter(Boolean);
  return parts.join(' · ');
}

export function getCurrentChapter(kb: KnowledgeBase): string {
  const explicit = kb.goals?.currentChapter?.trim();
  if (explicit) return explicit;
  const focus = kb.work?.careerFocus?.trim();
  if (focus) return focus;
  const aspirations = kb.identity?.aspirations?.trim();
  if (aspirations) {
    return aspirations.length > 280 ? `${aspirations.slice(0, 277)}…` : aspirations;
  }
  return '';
}

export function getPrioritizedJobs(kb: KnowledgeBase, limit = 5): JobApplication[] {
  const projects = kb.work?.currentProjects;
  if (!projects || Array.isArray(projects)) return [];
  return [...(projects.jobApplications ?? [])]
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, limit);
}

export function getCoolingContacts(kb: KnowledgeBase): ContactGraphEntry[] {
  const reviewDays = kb.relationships?.reviewFrequency ?? 21;
  const thresholdMs = Date.now() - reviewDays * 24 * 60 * 60 * 1000;
  return buildContactGraph(kb).filter(entry => {
    if (!entry.lastTouch) return true;
    const touch = new Date(entry.lastTouch).getTime();
    return !Number.isNaN(touch) && touch < thresholdMs;
  });
}

export function getFeaturedContacts(kb: KnowledgeBase, limit = 3): ContactGraphEntry[] {
  return buildContactGraph(kb).slice(0, limit);
}

export function formatLastTouch(iso?: string): string {
  if (!iso) return 'No recent touch';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function domainHasData(kb: KnowledgeBase, domain: ProfileDomain): boolean {
  return domainFilled(kb, domain);
}
