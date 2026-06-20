import { describe, it, expect } from 'vitest';
import { shouldAuditStatus } from './queue-audit';
import { auditStatusLabel } from './action-labels';

describe('shouldAuditStatus', () => {
  it('audits resolution statuses', () => {
    expect(shouldAuditStatus('approved')).toBe(true);
    expect(shouldAuditStatus('rejected')).toBe(true);
    expect(shouldAuditStatus('executed')).toBe(true);
    expect(shouldAuditStatus('failed')).toBe(true);
  });

  it('skips pending', () => {
    expect(shouldAuditStatus('pending')).toBe(false);
  });
});

describe('auditStatusLabel', () => {
  it('maps resolution statuses for UI', () => {
    expect(auditStatusLabel('executed')).toBe('Sent');
    expect(auditStatusLabel('saved')).toBe('Saved to drafts');
    expect(auditStatusLabel('rejected')).toBe('Rejected');
  });
});
