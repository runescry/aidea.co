import { describe, it, expect } from 'vitest';
import { shouldAuditStatus } from './queue-audit';

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
