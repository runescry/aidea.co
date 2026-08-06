import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: mocks.existsSync,
  mkdirSync: mocks.mkdirSync,
  readFileSync: mocks.readFileSync,
  writeFileSync: mocks.writeFileSync,
}));

import { mergeProfile } from './filesystem';

describe('filesystem mergeProfile', () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = { family: {} };
    mocks.existsSync.mockReturnValue(true);
    mocks.readFileSync.mockImplementation(() => JSON.stringify(store));
    mocks.writeFileSync.mockImplementation((_path: string, data: string) => {
      store = JSON.parse(data);
    });
  });

  it('accumulates back-to-back merges instead of the second dropping the first', async () => {
    await Promise.all([
      mergeProfile({ 'family.schoolFeed.gmail': { roundups: [1] } }),
      mergeProfile({ 'family.schoolFeed.calendar': { events: [] } }),
    ]);

    expect(store).toEqual({
      family: { schoolFeed: { gmail: { roundups: [1] }, calendar: { events: [] } } },
    });
  });

  it('merges dot-path updates without touching sibling keys', async () => {
    store = { family: { schoolFeed: { gmail: { roundups: [9] }, sharepoint: { news: [] } } } };

    await mergeProfile({ 'family.schoolFeed.calendar': { events: ['library'] } });

    expect(store).toEqual({
      family: {
        schoolFeed: {
          gmail: { roundups: [9] },
          sharepoint: { news: [] },
          calendar: { events: ['library'] },
        },
      },
    });
  });

  it('merges plain top-level keys directly', async () => {
    await mergeProfile({ agentOverrides: { foo: 'bar' } });

    expect(store).toEqual({ family: {}, agentOverrides: { foo: 'bar' } });
  });
});
