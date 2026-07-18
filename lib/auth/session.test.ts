import { describe, expect, it } from 'vitest';
import { createUserId, isDemoUserId, normalizeUserId } from './session';

describe('auth session user ids', () => {
  it('creates scoped google and demo user ids', () => {
    expect(createUserId('google')).toMatch(/^google:[a-f0-9-]{36}$/);
    expect(createUserId('demo')).toMatch(/^demo:[a-f0-9-]{36}$/);
  });

  it('normalizes supported scoped ids and rejects unknown ids', () => {
    expect(normalizeUserId('google:User_123@example.com')).toBe('google:user_123-example-com');
    expect(normalizeUserId('demo:ABC_123')).toBe('demo:abc_123');
    expect(normalizeUserId('default')).toBeNull();
    expect(normalizeUserId('admin:abc')).toBeNull();
  });

  it('detects demo tenants', () => {
    expect(isDemoUserId('demo:abc')).toBe(true);
    expect(isDemoUserId('google:abc')).toBe(false);
  });
});
