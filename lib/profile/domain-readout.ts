import type { CurrentProjects, JobApplication, KnowledgeBase } from '@/types/knowledge-base';
import { hasProjects } from '@/types/knowledge-base';
import { readHealthSyncSnapshot } from '@/lib/health/sync';
import { buildContactGraph } from '@/lib/contacts/interaction-graph';

function formatProjectSummary(projects?: CurrentProjects): string {
  if (!projects) return '0 listed';
  if (Array.isArray(projects)) return `${projects.length} listed`;
  const jobs = projects.jobApplications?.length ?? 0;
  const builds = projects.personalBuilds?.length ?? 0;
  return `${jobs} applications, ${builds} builds`;
}

export function isNoiseJobApplication(job: JobApplication): boolean {
  const company = job.company?.trim() ?? '';
  if (/^aidea-?e2e-/i.test(company)) return true;
  if (/e2e verify/i.test(job.nextAction ?? '')) return true;
  return false;
}

export function workDomainReadout(kb: KnowledgeBase): string[] {
  const lines: string[] = [];
  const role = kb.work?.role?.trim() || kb.identity?.role?.trim();
  if (role) lines.push(role);
  if (kb.work?.careerFocus?.trim()) lines.push(kb.work.careerFocus.trim());
  if (hasProjects(kb.work?.currentProjects)) {
    lines.push(`Projects: ${formatProjectSummary(kb.work?.currentProjects)}`);
  }
  if (kb.work?.communicationStyle?.trim()) {
    lines.push(`Comms: ${kb.work.communicationStyle.trim().slice(0, 120)}${kb.work.communicationStyle.length > 120 ? '…' : ''}`);
  }
  return lines;
}

export function identityDomainReadout(kb: KnowledgeBase): string[] {
  const lines: string[] = [];
  if (kb.identity?.bio?.trim()) {
    const bio = kb.identity.bio.trim();
    lines.push(bio.length > 240 ? `${bio.slice(0, 237)}…` : bio);
  }
  if (kb.goals?.lifePriorities?.length) {
    lines.push(`Priorities: ${kb.goals.lifePriorities.slice(0, 5).join(', ')}`);
  }
  if (kb.family?.partner?.name?.trim()) {
    lines.push(`Partner: ${kb.family.partner.name}`);
  }
  return lines;
}

export function contactsDomainReadout(kb: KnowledgeBase): string[] {
  const graph = buildContactGraph(kb);
  if (graph.length === 0) return ['No contacts tracked yet.'];
  return graph.slice(0, 8).map(c => {
    const meta = [c.company, c.relationship].filter(Boolean).join(' · ');
    return meta ? `${c.name} (${meta})` : c.name;
  });
}

export function healthDomainReadout(kb: KnowledgeBase): string[] {
  const sync = readHealthSyncSnapshot(kb);
  const lines: string[] = [];
  if (sync.recentActivities.length) {
    lines.push(`${sync.recentActivities.length} activities synced this week`);
  }
  if (kb.health?.currentGoals?.length) {
    lines.push(`Goals: ${kb.health.currentGoals.join(', ')}`);
  }
  const days = Object.entries(kb.health?.workoutSchedule ?? {}).filter(([, v]) => v?.trim());
  if (days.length) {
    lines.push(`Schedule: ${days.map(([d, v]) => `${d} ${v}`).join('; ')}`);
  }
  return lines.length ? lines : ['No health profile yet.'];
}

export function preferencesDomainReadout(kb: KnowledgeBase): string[] {
  const lines: string[] = [];
  if (kb.preferences?.briefingTime?.trim()) lines.push(`Brief: ${kb.preferences.briefingTime}`);
  if (kb.preferences?.newsTopics?.length) {
    lines.push(`News: ${kb.preferences.newsTopics.join(', ')}`);
  }
  if (kb.preferences?.writingTone?.trim()) lines.push(`Tone: ${kb.preferences.writingTone}`);
  return lines.length ? lines : ['Defaults — set briefing time and news topics.'];
}

export function financeDomainReadout(kb: KnowledgeBase): string[] {
  const subs = kb.finance?.subscriptions?.filter(s => s.name?.trim()) ?? [];
  if (subs.length === 0 && !kb.finance?.monthlyBudgetNotes?.trim()) {
    return ['No finance notes yet.'];
  }
  const lines: string[] = subs.slice(0, 6).map(s => s.name);
  if (kb.finance?.monthlyBudgetNotes?.trim()) lines.push(kb.finance.monthlyBudgetNotes.trim());
  return lines;
}

export function domainReadout(kb: KnowledgeBase, domain: string): string[] {
  switch (domain) {
    case 'identity': return identityDomainReadout(kb);
    case 'work': return workDomainReadout(kb);
    case 'contacts': return contactsDomainReadout(kb);
    case 'health': return healthDomainReadout(kb);
    case 'preferences': return preferencesDomainReadout(kb);
    case 'finance': return financeDomainReadout(kb);
    default: return [];
  }
}

export function chatPromptForDomain(domain: string): string {
  switch (domain) {
    case 'work': return 'Update my work profile: ';
    case 'identity': return 'Update my identity and goals: ';
    case 'contacts': return 'Update my relationships and key contacts: ';
    case 'health': return 'Update my health profile: ';
    case 'preferences': return 'Update my preferences (briefing, news, tone): ';
    case 'finance': return 'Update my finance subscriptions and budget notes: ';
    default: return 'Update my profile: ';
  }
}
