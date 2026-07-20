import { describe, expect, it } from 'vitest';
import { buildMonitorTargets } from './accounts';

describe('buildMonitorTargets', () => {
  it('includes registered users and the legacy fallback once', () => {
    const targets = buildMonitorTargets([
      { userId: 'google:one', nangoUserId: 'google:temp-one' },
      { userId: 'default', nangoUserId: 'default-owner' },
    ], 'default');

    expect(targets).toEqual([
      { userId: 'google:one', nangoUserId: 'google:temp-one' },
      { userId: 'default', nangoUserId: 'default-owner' },
    ]);
  });

  it('can exclude the legacy fallback after migration', () => {
    expect(buildMonitorTargets([], 'default', false)).toEqual([]);
  });
});

