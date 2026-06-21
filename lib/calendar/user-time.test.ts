import { describe, expect, it } from 'vitest';
import {
  isUserLocalSameDay,
  resolveUserTimezone,
  userDateContext,
  userDateYmd,
} from './user-time';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('user-time', () => {
  it('uses profile timezone when set', () => {
    const kb: KnowledgeBase = { identity: { timezone: 'Australia/Sydney' } };
    expect(resolveUserTimezone(kb)).toBe('Australia/Sydney');
  });

  it('maps UTC instant to Sydney calendar date across midnight', () => {
    // 2026-06-21 22:00 UTC = 2026-06-22 08:00 AEST (+10) / 09:00 AEDT (+11)
    const instant = new Date('2026-06-21T22:00:00.000Z');
    expect(userDateYmd(instant, 'Australia/Sydney')).toBe('2026-06-22');
    expect(userDateYmd(instant, 'UTC')).toBe('2026-06-21');
  });

  it('builds daily context in user timezone', () => {
    const instant = new Date('2026-06-21T22:00:00.000Z');
    const ctx = userDateContext(instant, 'Australia/Sydney');
    expect(ctx.currentDate).toBe('2026-06-22');
    expect(ctx.dayOfWeek).toBe('Monday');
    expect(ctx.userTimezone).toBe('Australia/Sydney');
  });

  it('matches brief date to user local today', () => {
    const now = new Date('2026-06-21T22:30:00.000Z');
    expect(isUserLocalSameDay('2026-06-22', now, 'Australia/Sydney')).toBe(true);
    expect(isUserLocalSameDay('2026-06-21', now, 'Australia/Sydney')).toBe(false);
  });
});
