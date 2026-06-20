import { describe, it, expect } from 'vitest';
import { isOnboardingComplete, getOnboardingProgress } from './onboarding';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('isOnboardingComplete', () => {
  it('returns true when onboardingComplete flag is set', () => {
    const kb: KnowledgeBase = {
      preferences: { onboardingComplete: true },
    };
    expect(isOnboardingComplete(kb)).toBe(true);
  });

  it('returns true for legacy deep profile without flag', () => {
    const kb: KnowledgeBase = {
      identity: { name: 'Alex', bio: 'Founder' },
      work: { role: 'CEO' },
      goals: { lifePriorities: ['family'] },
    };
    expect(isOnboardingComplete(kb)).toBe(true);
  });

  it('returns false for empty profile', () => {
    expect(isOnboardingComplete({})).toBe(false);
  });
});

describe('getOnboardingProgress', () => {
  it('counts completed profile sections', () => {
    const kb: KnowledgeBase = {
      identity: { name: 'Alex', bio: 'Bio', values: ['honesty'] },
      work: { role: 'CEO' },
    };
    const { completed, total } = getOnboardingProgress(kb);
    expect(completed).toBeGreaterThan(0);
    expect(total).toBe(15);
  });
});
