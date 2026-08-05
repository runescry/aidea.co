import { describe, expect, it } from 'vitest';
import { ensureSchoolChildrenConfigured } from './school-migrate';
import { DEFAULT_SCHOOL_CHILDREN } from '@/lib/harness/school-config';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('ensureSchoolChildrenConfigured', () => {
  it('seeds explicit children when family has none', () => {
    const kb: KnowledgeBase = {};
    const next = ensureSchoolChildrenConfigured(kb);
    expect(next.family?.children).toHaveLength(2);
    expect(next.family?.children?.[0]).toMatchObject({
      name: 'Ivy',
      senderDomains: ['genazzano.vic.edu.au'],
    });
    expect(next.family?.children?.[1]).toMatchObject({
      name: 'Sebastian',
      senderDomains: ['xavier.vic.edu.au'],
    });
  });

  it('fills sender domains on existing children matched by name', () => {
    const kb: KnowledgeBase = {
      family: {
        children: [{ name: 'Ivy', school: 'Genazzano FCJ College' }],
      },
    };
    const next = ensureSchoolChildrenConfigured(kb);
    expect(next.family?.children?.[0]?.senderDomains).toEqual(['genazzano.vic.edu.au']);
  });

  it('is idempotent when children already configured', () => {
    const kb: KnowledgeBase = {
      family: { children: DEFAULT_SCHOOL_CHILDREN.map(c => ({ ...c })) },
    };
    expect(ensureSchoolChildrenConfigured(kb)).toBe(kb);
  });
});
