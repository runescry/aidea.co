import { describe, expect, it } from 'vitest';
import {
  findJobApplicationIndex,
  getCoolingContacts,
  getCurrentChapter,
  getPrioritizedJobs,
  isNoiseJobApplication,
  profileCompletenessPercent,
  profileDisplayName,
} from './summary';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('profile summary', () => {
  it('uses explicit current chapter only', () => {
    const kb: KnowledgeBase = {
      goals: { currentChapter: 'Waiting on Anthropic outcome.' },
      work: { careerFocus: 'Other focus' },
    };
    expect(getCurrentChapter(kb)).toBe('Waiting on Anthropic outcome.');
    expect(getCurrentChapter({ work: { careerFocus: 'Hidden' } })).toBe('');
  });

  it('sorts job applications by priority and drops noise', () => {
    const kb: KnowledgeBase = {
      work: {
        currentProjects: {
          jobApplications: [
            { company: 'B', priority: 2 },
            { company: 'A', priority: 1 },
            { company: 'AideaE2E-123', priority: 1, nextAction: 'E2E verify' },
          ],
        },
      },
    };
    expect(isNoiseJobApplication({ company: 'AideaE2E-1' })).toBe(true);
    expect(getPrioritizedJobs(kb).map(j => j.company)).toEqual(['A', 'B']);
  });

  it('marks only stale touches as cooling', () => {
    const stale = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const kb: KnowledgeBase = {
      relationships: {
        reviewFrequency: 21,
        interactionGraph: {
          entries: [{ name: 'Natalie', lastTouch: stale }],
        },
      },
    };
    expect(getCoolingContacts(kb)).toHaveLength(1);
    expect(getCoolingContacts({ work: { keyContacts: [{ name: 'No touch' }] } })).toHaveLength(0);
  });

  it('finds job index by company and role', () => {
    const kb: KnowledgeBase = {
      work: {
        currentProjects: {
          jobApplications: [{ company: 'Anthropic', role: 'Head', status: 'Waiting' }],
        },
      },
    };
    expect(findJobApplicationIndex(kb, { company: 'Anthropic', role: 'Head' })).toBe(0);
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
