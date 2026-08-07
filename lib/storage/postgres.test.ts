import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  getSql: mocks.getSql,
  toJson: (v: unknown) => v,
}));

import { mergeProfile } from './postgres';

/**
 * Fakes the `postgres` tagged-template API closely enough to exercise mergeProfile's real
 * control flow: a callable tag function with `.json()`, plus `.begin(cb)` that hands the same
 * tag (as `tx`) to the callback — so the row-lock read and the final write share one "connection",
 * same as the real driver's transaction-scoped `sql`.
 */
function fakeSql(initialData: Record<string, unknown> | null) {
  let store = initialData;
  let rowExists = initialData !== null;
  const calls: string[] = [];

  const tag = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('¦');
    calls.push(text);
    if (text.includes('DO NOTHING')) {
      if (!rowExists) {
        store = {};
        rowExists = true;
      }
      return [];
    }
    if (text.includes('FOR UPDATE')) {
      return [{ data: store ?? {} }];
    }
    if (text.includes('UPDATE profiles SET data')) {
      store = values[0] as Record<string, unknown>;
      return [];
    }
    return [];
  }) as unknown as { (s: TemplateStringsArray, ...v: unknown[]): Promise<unknown[]>; json: (v: unknown) => unknown; begin: (cb: (tx: unknown) => Promise<void>) => Promise<void> };

  tag.json = (v: unknown) => v;
  tag.begin = async (cb: (tx: unknown) => Promise<void>) => {
    await cb(tag);
  };

  return { tag, calls, getStore: () => store };
}

describe('postgres mergeProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps the merge in a transaction and locks the row with FOR UPDATE', async () => {
    const { tag, calls } = fakeSql({ family: { children: [] } });
    mocks.getSql.mockReturnValue(tag);

    await mergeProfile('user-1', { 'family.schoolFeed.calendar': { events: [] } });

    expect(calls.some(c => c.includes('FOR UPDATE'))).toBe(true);
    expect(calls.some(c => c.includes('DO NOTHING'))).toBe(true);
  });

  it('merges dot-path updates onto the locked row without touching sibling keys', async () => {
    const { tag, getStore } = fakeSql({
      family: {
        schoolFeed: {
          gmail: { roundups: [], actionRequired: [], fyi: [] },
          sharepoint: { news: [], documents: [] },
        },
      },
    });
    mocks.getSql.mockReturnValue(tag);

    await mergeProfile('user-1', {
      'family.schoolFeed.calendar': { events: ['library'] },
      'family.schoolFeed.updatedAt': '2026-08-06T00:00:00.000Z',
    });

    const store = getStore() as Record<string, any>;
    expect(store.family.schoolFeed.calendar).toEqual({ events: ['library'] });
    expect(store.family.schoolFeed.updatedAt).toBe('2026-08-06T00:00:00.000Z');
    // Sections this merge doesn't own survive untouched.
    expect(store.family.schoolFeed.gmail).toEqual({ roundups: [], actionRequired: [], fyi: [] });
    expect(store.family.schoolFeed.sharepoint).toEqual({ news: [], documents: [] });
  });

  it('reads state written by an earlier merge, not a stale outer snapshot', async () => {
    // Simulates two "cron jobs" landing back to back — the second must build on the first's
    // committed row, which is exactly what the FOR UPDATE lock + in-transaction read guarantees
    // and what a plain readProfile()-then-writeProfile() cannot.
    const { tag, getStore } = fakeSql({ family: {} });
    mocks.getSql.mockReturnValue(tag);

    await mergeProfile('user-1', { 'family.schoolFeed.gmail': { roundups: [1] } });
    await mergeProfile('user-1', { 'family.schoolFeed.calendar': { events: [] } });

    const store = getStore() as Record<string, any>;
    expect(store.family.schoolFeed.gmail).toEqual({ roundups: [1] });
    expect(store.family.schoolFeed.calendar).toEqual({ events: [] });
  });

  it('seeds an empty row via INSERT ON CONFLICT DO NOTHING when the user has no profile yet', async () => {
    const { tag, getStore } = fakeSql(null);
    mocks.getSql.mockReturnValue(tag);

    await mergeProfile('new-user', { 'preferences.onboardingComplete': true });

    expect(getStore()).toEqual({ preferences: { onboardingComplete: true } });
  });

  it('merges plain (non dot-path) top-level keys directly', async () => {
    const { tag, getStore } = fakeSql({ existing: 'value' });
    mocks.getSql.mockReturnValue(tag);

    await mergeProfile('user-1', { agentOverrides: { foo: 'bar' } });

    expect(getStore()).toEqual({ existing: 'value', agentOverrides: { foo: 'bar' } });
  });
});
