import { describe, expect, it } from 'vitest';
import {
  buildSchoolGmailFromQuery,
  DEFAULT_SCHOOL_CHILDREN,
  DEFAULT_SCHOOL_PROFILES,
  loadSchoolProfiles,
  schoolFromSender,
} from './school-config';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('loadSchoolProfiles', () => {
  it('returns runtime defaults when KB is not provided', () => {
    expect(loadSchoolProfiles()).toEqual(DEFAULT_SCHOOL_PROFILES);
    expect(DEFAULT_SCHOOL_PROFILES[0]?.senderDomains).toContain('genazzano.vic.edu.au');
  });

  it('returns empty when KB has no children', () => {
    expect(loadSchoolProfiles({})).toEqual([]);
  });

  it('builds profiles from KB children with explicit sender domains', () => {
    const kb: KnowledgeBase = {
      family: {
        children: DEFAULT_SCHOOL_CHILDREN.map(c => ({ ...c })),
      },
    };
    const profiles = loadSchoolProfiles(kb);
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({
      school: 'Genazzano FCJ College',
      child: 'Ivy',
      senderDomains: ['genazzano.vic.edu.au'],
    });
    expect(profiles[1]).toMatchObject({
      school: 'Xavier College',
      child: 'Sebastian',
      senderDomains: ['xavier.vic.edu.au'],
    });
  });

  it('does not infer sender patterns from school name', () => {
    const kb: KnowledgeBase = {
      family: {
        children: [{ name: 'Sam', school: 'Oak Primary School' }],
      },
    };
    const profiles = loadSchoolProfiles(kb);
    expect(profiles[0]?.senderPatterns).toBeUndefined();
    expect(profiles[0]?.senderDomains).toBeUndefined();
  });
});

describe('schoolFromSender', () => {
  const profiles = loadSchoolProfiles({
    family: { children: DEFAULT_SCHOOL_CHILDREN.map(c => ({ ...c })) },
  });

  it('detects Genazzano by domain', () => {
    expect(schoolFromSender('Genazzano FCJ College <office@genazzano.vic.edu.au>', profiles)).toEqual({
      school: 'Genazzano FCJ College',
      child: 'Ivy',
    });
  });

  it('detects Xavier by domain', () => {
    expect(schoolFromSender('Xavier College <news@xavier.vic.edu.au>', profiles)).toEqual({
      school: 'Xavier College',
      child: 'Sebastian',
    });
  });

  it('matches real school notification senders by domain only', () => {
    expect(schoolFromSender('Genazzano FCJ College <genconnect@genazzano.vic.edu.au>', profiles)).toEqual({
      school: 'Genazzano FCJ College',
      child: 'Ivy',
    });
    expect(schoolFromSender('Consent2Go <Consent2Go@xavier.vic.edu.au>', profiles)).toEqual({
      school: 'Xavier College',
      child: 'Sebastian',
    });
  });

  it('uses KB profiles when provided', () => {
    const custom: KnowledgeBase = {
      family: {
        children: [
          {
            name: 'Alex',
            school: 'St Kilda Primary',
            senderDomains: ['stkilda.edu.au'],
          },
        ],
      },
    };
    const customProfiles = loadSchoolProfiles(custom);
    expect(schoolFromSender('St Kilda Primary <office@stkilda.edu.au>', customProfiles)).toEqual({
      school: 'St Kilda Primary',
      child: 'Alex',
    });
  });
});

describe('buildSchoolGmailFromQuery', () => {
  it('builds from clause from explicit KB profiles', () => {
    const profiles = loadSchoolProfiles({
      family: { children: DEFAULT_SCHOOL_CHILDREN.map(c => ({ ...c })) },
    });
    const q = buildSchoolGmailFromQuery(profiles);
    expect(q).toMatch(/^from:\(/);
    expect(q).toMatch(/@genazzano\.vic\.edu\.au/);
    expect(q).toMatch(/@xavier\.vic\.edu\.au/);
  });
});
