import type { KnowledgeBase } from '@/types/knowledge-base';
import type { ActionType } from './queue-types';

export type AutonomyDomain = 'email' | 'calendar' | 'kb' | 'finance' | 'health';
export type AutonomyLevel = NonNullable<KnowledgeBase['preferences']>['defaultAutonomyLevel'];

export const AUTONOMY_DOMAINS: Array<{ key: AutonomyDomain; label: string; hint: string }> = [
  { key: 'email', label: 'Email', hint: 'Replies and outreach drafts' },
  { key: 'calendar', label: 'Calendar', hint: 'Events and holds' },
  { key: 'kb', label: 'Profile', hint: 'Knowledge base updates' },
  { key: 'finance', label: 'Finance', hint: 'Money actions — default supervised' },
  { key: 'health', label: 'Health', hint: 'Training and wellness updates' },
];

const ACTION_DOMAIN: Partial<Record<ActionType, AutonomyDomain>> = {
  email_reply: 'email',
  email_send: 'email',
  calendar_event: 'calendar',
  kb_update: 'kb',
};

export function readDomainAutonomy(kb: KnowledgeBase): Record<AutonomyDomain, AutonomyLevel> {
  const fallback = kb.preferences?.defaultAutonomyLevel ?? 'semi-autonomous';
  const stored = kb.preferences?.domainAutonomy ?? {};
  return {
    email: stored.email ?? fallback,
    calendar: stored.calendar ?? fallback,
    kb: stored.kb ?? fallback,
    finance: stored.finance ?? 'supervised',
    health: stored.health ?? fallback,
  };
}

export function autonomyForAction(kb: KnowledgeBase, actionType: ActionType): AutonomyLevel {
  const domain = ACTION_DOMAIN[actionType];
  if (!domain) return kb.preferences?.defaultAutonomyLevel ?? 'semi-autonomous';
  return readDomainAutonomy(kb)[domain];
}

export function shouldAutoExecuteAction(
  autonomy: AutonomyLevel,
  requireApproval?: boolean,
): boolean {
  if (requireApproval) return false;
  return autonomy === 'autonomous';
}

export function domainAutonomyLabel(level: AutonomyLevel): string {
  if (level === 'supervised') return 'Supervised';
  if (level === 'autonomous') return 'Autonomous';
  return 'Semi-autonomous';
}

export function domainAutonomyHint(domain: AutonomyDomain, level: AutonomyLevel): string {
  if (domain === 'finance' && level !== 'supervised') return 'Finance actions still require explicit approval in P7.';
  if (level === 'supervised') return 'Always queues for your approval';
  if (level === 'autonomous') return 'May auto-apply within guardrails';
  return 'Drafts queue for review';
}
