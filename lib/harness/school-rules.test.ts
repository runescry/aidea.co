import { describe, expect, it } from 'vitest';
import type { CachedGmail } from './inbox-sanitize';
import {
  classifySchoolEmails,
  parseSchoolDeadline,
  partitionSchoolRows,
} from './school-rules';
import { DEFAULT_SCHOOL_PROFILES } from './school-config';

function email(overrides: Partial<CachedGmail> & Pick<CachedGmail, 'id' | 'from' | 'subject'>): CachedGmail {
  return {
    snippet: '',
    ...overrides,
  };
}

describe('classifySchoolEmails', () => {
  it('classifies permission slip as action_required', () => {
    const rows = classifySchoolEmails([
      email({
        id: 'm1',
        from: 'Genazzano FCJ College <office@genazzano.vic.edu.au>',
        subject: 'Permission form — swimming carnival',
        snippet: 'Please sign and return the consent form by Friday',
      }),
    ], DEFAULT_SCHOOL_PROFILES);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.category).toBe('permission');
    expect(rows[0]?.priority).toBe('action_required');
    expect(rows[0]?.child).toBe('Ivy');
  });

  it('classifies newsletter as fyi', () => {
    const rows = classifySchoolEmails([
      email({
        id: 'm2',
        from: 'Xavier College <news@xavier.vic.edu.au>',
        subject: 'Weekly school newsletter',
        snippet: 'Term 2 events and updates for families',
      }),
    ], DEFAULT_SCHOOL_PROFILES);

    expect(rows[0]?.category).toBe('newsletter');
    expect(rows[0]?.priority).toBe('fyi');
    expect(rows[0]?.child).toBe('Sebastian');
  });

  it('ignores non-school senders', () => {
    const rows = classifySchoolEmails([
      email({
        id: 'm3',
        from: 'Stripe <billing@stripe.com>',
        subject: 'Payment failed',
        snippet: 'Your card was declined',
      }),
    ], DEFAULT_SCHOOL_PROFILES);
    expect(rows).toHaveLength(0);
  });

  it('partitions action vs fyi', () => {
    const rows = classifySchoolEmails([
      email({
        id: 'a',
        from: 'Genazzano <office@genazzano.vic.edu.au>',
        subject: 'Excursion payment due',
        snippet: 'Please pay $25 by 15 August 2026',
      }),
      email({
        id: 'b',
        from: 'Genazzano <office@genazzano.vic.edu.au>',
        subject: 'Newsletter',
        snippet: 'School newsletter for Ivy families',
      }),
    ], DEFAULT_SCHOOL_PROFILES);

    const { actionRequired, fyi } = partitionSchoolRows(rows);
    expect(actionRequired.length).toBeGreaterThan(0);
    expect(fyi.length).toBeGreaterThan(0);
  });
});

describe('parseSchoolDeadline', () => {
  it('parses ISO dates', () => {
    expect(parseSchoolDeadline('Due by 2026-08-15')).toBe('2026-08-15');
  });

  it('parses day month year', () => {
    expect(parseSchoolDeadline('Return form by 15 August 2026')).toBe('2026-08-15');
  });
});
