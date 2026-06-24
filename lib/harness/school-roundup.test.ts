import { describe, expect, it } from 'vitest';
import type { CachedGmail } from './inbox-sanitize';
import { bundleSchoolTriage, schoolFromSender } from './school-roundup';

function genazzanoRow(overrides: Record<string, unknown> = {}) {
  return {
    from: 'Genazzano FCJ College',
    subject: 'Term reminder',
    snippet: 'Reminder for Ivy families',
    messageId: overrides.messageId ?? `msg-${Math.random()}`,
    reason: 'School reminder',
    action: 'Review this email',
    urgency: 'HIGH',
    ...overrides,
  };
}

describe('schoolFromSender', () => {
  it('detects Genazzano', () => {
    expect(schoolFromSender('Genazzano FCJ College <office@genazzano.vic.edu.au>')).toEqual({
      school: 'Genazzano',
      child: 'Ivy',
    });
  });
});

describe('bundleSchoolTriage', () => {
  const cache = new Map<string, CachedGmail>([
    ['g1', { id: 'g1', from: 'Genazzano', subject: 'Report', snippet: 'Report for Ivy' }],
    ['g2', { id: 'g2', from: 'Genazzano', subject: 'Sport', snippet: 'Carnival Monday' }],
    ['g3', { id: 'g3', from: 'Genazzano', subject: 'Phone', snippet: 'Confirm phone', bodyText: 'Please confirm phone' }],
  ]);

  it('bundles 2+ same-school emails into schoolRoundups', () => {
    const out = bundleSchoolTriage({
      urgent: [
        genazzanoRow({ messageId: 'g1', subject: 'Semester report', urgency: 'HIGH', action: 'Confirm phone number' }),
        genazzanoRow({ messageId: 'g2', subject: 'Sports carnival', urgency: 'HIGH' }),
        genazzanoRow({ messageId: 'g3', subject: 'Canteen menu', urgency: 'NORMAL', action: 'Review this email' }),
      ],
      actionRequired: [],
      fyi: [],
    }, cache);

    expect(out.schoolRoundups).toHaveLength(1);
    const roundup = out.schoolRoundups![0] as { school: string; child: string; emailCount: number; needsYou: unknown[] };
    expect(roundup.school).toBe('Genazzano');
    expect(roundup.child).toBe('Ivy');
    expect(roundup.emailCount).toBe(3);
    expect(roundup.needsYou.length).toBeGreaterThan(0);
    expect(out.urgent).toHaveLength(0);
    expect(out.actionRequired?.some(row =>
      row && typeof row === 'object' && (row as Record<string, unknown>).kind === 'school_roundup',
    )).toBe(true);
  });

  it('leaves single school email unbundled', () => {
    const out = bundleSchoolTriage({
      urgent: [genazzanoRow({ messageId: 'g1' })],
      actionRequired: [],
      fyi: [],
    }, cache);
    expect(out.schoolRoundups).toBeUndefined();
    expect(out.urgent).toHaveLength(1);
  });
});
