import { describe, expect, it } from 'vitest';
import {
  getCoolingContacts,
  getCurrentChapter,
  getPrioritizedJobs,
  profileCompletenessPercent,
  profileDisplayName,
} from './summary';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('profile summary', () => {
  it('prefers explicit current chapter', () => {
    const kb: KnowledgeBase = {
      goals: { currentChapter: 'Waiting on Anthropic outcome.' },
      work: { careerFocus: 'Other focus' },
    };
    expect(getCurrentChapter(kb)).toBe('Waiting on Anthropic outcome.');
  });

  it('sorts job applications by priority', () => {
    const kb: KnowledgeBase = {
      work: {
        currentProjects: {
          jobApplications: [
            { company: 'B', priority: 2 },
            { company: 'A', priority: 1 },
          ],
        },
      },
    };
    expect(getPrioritizedJobs(kb).map(j => j.company)).toEqual(['A', 'B']);
  });

  it('marks contacts without touch as cooling', () => {
    const kb: KnowledgeBase = {
      work: { keyContacts: [{ name: 'Natalie Mead' }] },
    };
    expect(getCoolingContacts(kb)).toHaveLength(1);
  });

  it('computes completeness from filled domains', () => {
    const kb: KnowledgeBase = {
      identity: { name: 'Marcus' },
      work: { role: 'Consultant' },
    };
    expect(profileCompletenessPercent(kb)).toBeGreaterThan(0);
    expect(profileDisplayName(kb)).toBe('Marcus');
  });
});
