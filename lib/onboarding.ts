import type { KnowledgeBase } from '@/types/knowledge-base';
import { hasProjects } from '@/types/knowledge-base';

export function isOnboardingComplete(kb: KnowledgeBase): boolean {
  if (kb.preferences?.onboardingComplete) return true;

  const hasIdentity = Boolean(kb.identity?.name?.trim());
  const hasWork = Boolean(kb.work?.role?.trim() || kb.identity?.role?.trim());
  const hasDepth = Boolean(
    kb.identity?.bio?.trim()
    || hasProjects(kb.work?.currentProjects)
    || (kb.goals?.lifePriorities?.length ?? 0) > 0
  );

  return hasIdentity && hasWork && hasDepth;
}

export function getOnboardingProgress(kb: KnowledgeBase): { completed: number; total: number } {
  const checks = [
    Boolean(kb.identity?.name?.trim()),
    Boolean(kb.identity?.bio?.trim() && (kb.identity?.values?.length ?? 0) > 0),
    Boolean(kb.identity?.workEmail?.trim() || kb.identity?.personalEmail?.trim()),
    Boolean(kb.work?.role?.trim()),
    Boolean((kb.work?.keyContacts?.length ?? 0) > 0 || (kb.work?.keyStakeholders?.length ?? 0) > 0),
    Boolean(hasProjects(kb.work?.currentProjects)),
    Boolean(kb.work?.typicalDay?.trim() || kb.work?.meetingPreferences?.trim()),
    Boolean((kb.work?.urgentFrom?.length ?? 0) > 0 || kb.work?.emailHandlingRules?.trim()),
    Boolean((kb.goals?.lifePriorities?.length ?? 0) > 0 && (kb.goals?.nonNegotiables?.length ?? 0) > 0),
    Boolean((kb.relationships?.mentors?.length ?? 0) > 0 || (kb.relationships?.collaborators?.length ?? 0) > 0),
    Boolean(kb.family?.householdNotes?.trim() || (kb.family?.children?.length ?? 0) > 0),
    Boolean(Object.values(kb.health?.workoutSchedule ?? {}).some(Boolean)),
    Boolean(kb.health?.sleepSchedule?.trim()),
    Boolean(kb.routines?.morningRoutine?.trim()),
    Boolean((kb.preferences?.newsTopics?.length ?? 0) > 0 && kb.preferences?.briefingTime?.trim()),
  ];

  return {
    completed: checks.filter(Boolean).length,
    total: checks.length,
  };
}
