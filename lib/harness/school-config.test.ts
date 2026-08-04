import { describe, expect, it } from 'vitest';
import {
  buildSchoolGmailFromQuery,
  DEFAULT_SCHOOL_PROFILES,
  loadSchoolProfiles,
  schoolFromSender,
} from './school-config';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('loadSchoolProfiles', () => {
  it('returns defaults when KB has no children', () => {
    expect(loadSchoolProfiles({})).toEqual(DEFAULT_SCHOOL_PROFILES);
  });

  it('builds profiles from KB children with sender domains', () => {
    const kb: KnowledgeBase = {
      family: {
        children: [
          {
            name: 'Ivy',
            school: 'Genazzano FCJ College',
            senderDomains: ['genazzano.vic.edu.au'],
          },
          {
            name: 'Sebastian',
            school: 'Xavier College',
            senderPatterns: ['xavier'],
          },
        ],
      },
    };
    const profiles = loadSchoolProfiles(kb);
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({ school: 'Genazzano FCJ College', child: 'Ivy' });
    expect(profiles[1]).toMatchObject({ school: 'Xavier College', child: 'Sebastian' });
  });

  it('guesses sender pattern from school name when none configured', () => {
    const kb: KnowledgeBase = {
      family: {
        children: [{ name: 'Sam', school: 'Oak Primary School' }],
      },
    };
    const profiles = loadSchoolProfiles(kb);
    expect(profiles[0]?.senderPatterns).toContain('oak');
  });
});

describe('schoolFromSender', () => {
  it('detects Genazzano by domain', () => {
    expect(schoolFromSender('Genazzano FCJ College <office@genazzano.vic.edu.au>')).toEqual({
      school: 'Genazzano',
      child: 'Ivy',
    });
  });

  it('detects Xavier by pattern', () => {
    expect(schoolFromSender('Xavier College <news@xavier.vic.edu.au>')).toEqual({
      school: 'Xavier College',
      child: 'Sebastian',
    });
  });

  it('uses KB profiles when provided', () => {
    const kb: KnowledgeBase = {
      family: {
        children: [
          { name: 'Alex', school: 'St Kilda Primary', senderPatterns: ['stkilda'] },
        ],
      },
    };
    const profiles = loadSchoolProfiles(kb);
    expect(schoolFromSender('St Kilda Primary <office@stkilda.edu.au>', profiles)).toEqual({
      school: 'St Kilda Primary',
      child: 'Alex',
    });
  });
});

describe('buildSchoolGmailFromQuery', () => {
  it('builds from clause from default profiles', () => {
    const q = buildSchoolGmailFromQuery();
    expect(q).toMatch(/^from:\(/);
    expect(q).toMatch(/genazzano/i);
  });
});
